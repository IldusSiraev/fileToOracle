"use strict";
import * as vscode from "vscode";
const pathModule = require("path");
const fs = require("fs");
const { exec } = require("child_process");
var iconv = require("iconv-lite");


export function activate(context: vscode.ExtensionContext) {

  vscode.commands.registerTextEditorCommand(
    "extension.fileToOra",
    (textEditor) => {
      let filePath =
        vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.fileName;
      let fileDir = pathModule.dirname(filePath);
      let fileName = pathModule.basename(filePath);
      let optionsFileContent = "";

      let settingsFilePath = fileDir + "\\" + fileName + ".c1ni";

      // Check if the file exists in the current directory.
      try {
        fs.accessSync(settingsFilePath, fs.constants.R_OK | fs.constants.W_OK);
        optionsFileContent = fs.readFileSync(settingsFilePath, "utf8");
      } catch (err) {
        console.error("Config file not exist");
      }

      getOracleData(settingsFilePath, optionsFileContent).then((options) => {
        console.log(options);

        //Проверка на корренктность ввода исходных данных для подключения к БД
        if (
          options.PROC_NAME === "" ||
          options.LOGIN === "" ||
          options.DBNAME === ""
        ) {
          vscode.window.showErrorMessage(
            "Не заполнены необходимы данные для подключения к бд. Повторите снова"
          );
          return false;
        }

        let newText = "";

        //mime header
        let mime_header = "";
        switch (options.CONTENT_TYPE) {
          case "1":
            mime_header =
              "  owa_util.mime_header(ccontent_type=>'text/html'); \n ";
            break;
          case "2":
            mime_header =
              "  owa_util.mime_header(ccontent_type=>'application/javascript'); \n ";
            break;
          case "3":
            mime_header =
              "  owa_util.mime_header(ccontent_type=>'text/css'); \n ";
            break;
          case "4":
            mime_header =
              "  owa_util.mime_header(ccontent_type=>'text/xml'); \n ";
            break;
          default:
            mime_header = "";
        }

        newText += "set define off \n ";
        newText += "create or replace procedure " + options.PROC_NAME;

        //Параметры процедуры
        if (options.PROC_PARAMS && options.PROC_PARAMS.length > 0) {
          newText += "(" + options.PROC_PARAMS + ") \n";
        }
        newText += " as \n ";

        //Авторизация
        if (options.AUTH && options.AUTH === "1") {
          newText += "  userid number; \n ";
          newText += "begin \n ";
          newText += "  userid := www.GET_G_USERID; \n ";
          newText += "  if userid is null then \n ";
          newText += "    www.CHECK_ACCESS; \n ";
          newText += "    userid:=www.GET_G_USERID; \n ";
          newText += "  end if; \n ";
        } else {
          newText += "begin \n ";
          newText += mime_header;
        }

        textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
          // Получаем текущий документ.
          const document = textEditor.document;
          // Получаем последнюю строку документа.
          const lastLine = document.lineAt(document.lineCount - 1);

          for (var i = 0; i <= lastLine.lineNumber; i++) {
            let startLinePos = new vscode.Position(i, 0);
            let endLinePos = new vscode.Position(
              i,
              document.lineAt(i).text.length
            );

            let rng = new vscode.Range(startLinePos, endLinePos);

            //замена в файле страницы всех ' на '' для нормальной компиляции в pl/sql oracle
            let lineText = textEditor.document.getText(rng).replace(/'/g, "''");

            newText += "  htp.p('" + lineText + "'); \n ";
          }
        });

        newText += "end; \n ";
        newText += "/ \n ";
        newText += "exit";

        //кодируем текст в кодировку windows - 1251
        const buf = iconv.encode(newText, "win1251");

        fs.writeFile(fileDir + "/" + options.PROC_NAME + ".sql", buf, function(
          err: any
        ) {
          if (err) {
            return console.log(err);
          }

          exec(
            "sqlplus " +
            options.LOGIN +
            "/" +
            options.PASS +
            "@" +
            options.DBNAME +
            ' @"' +
            fileDir +
            "\\" +
            options.PROC_NAME +
            '.sql"',
            (err: string, stdout: string, stderr: string) => {
              if (err) {
                // node couldn't execute the command
                return;
              }

              // the *entire* stdout and stderr (buffered)
              console.log(`stdout: ${stdout}`);
              console.log(`stderr: ${stderr}`);
            }
          );

          vscode.window.showInformationMessage(
            "Процедура успешно загружена в БД"
          );
        });
      });
    }
  );
}

async function getOracleData(
  settingsFilePath: String,
  optionsFileContent: string
) {
  let options = {
    LOGIN: "",
    PASS: "",
    DBNAME: "",
    PROC_NAME: "",
    CONTENT_TYPE: "",
    AUTH: "",
    PROC_PARAMS: "",
  };

  try {
    options = JSON.parse(optionsFileContent);
  } catch (e) {
    const login = await vscode.window.showInputBox({
      placeHolder: "Oracle username",
    });
    const pass = await vscode.window.showInputBox({
      placeHolder: "Oracle password",
    });
    const dbname = await vscode.window.showInputBox({
      placeHolder: "Oracle db",
    });
    const proc_name = await vscode.window.showInputBox({
      placeHolder: "Введите имя процедуры",
    });
    const nccontent_type = await vscode.window.showInputBox({
      placeHolder:
        "content type (1-text/html, 2-application/javascript, 3-text/css, 4-text/xml):",
    });
    const nautorization = await vscode.window.showInputBox({
      placeHolder: "Insert Authorization (www.CHECK_ACCESS)(1-Yes, 0-No):",
    });
    const sparams = await vscode.window.showInputBox({
      placeHolder: "Proc input params:",
    });

    //Проверка на корренктность ввода исходных данных для подключения к БД
    if (proc_name === "" || login === "" || dbname === "") {
      vscode.window.showErrorMessage(
        "Не заполнены необходимы данные для подключения к бд. Повторите снова"
      );
    } else {
      options = {
        LOGIN: login || "",
        PASS: pass || "",
        DBNAME: dbname || "",
        PROC_NAME: proc_name || "",
        CONTENT_TYPE: nccontent_type || "",
        AUTH: nautorization || "",
        PROC_PARAMS: sparams || "",
      };

      fs.writeFile(settingsFilePath, JSON.stringify(options), function(
        err: any
      ) {
        if (err) {
          return console.log(err);
        }

        console.log("Config file was saved!");
      });
    }
  }

  return options;
}

// this method is called when your extension is deactivated
export function deactivate() { }
