Option Explicit
Dim sh, fso, email, pw, folder, target, f, json
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
email = "vibratokoficial@gmail.com"
pw = InputBox("Escribe la CONTRASENA DE APLICACION de Google (no la contrasena normal de Gmail).", "VibraTok - Configurar correo")
If Len(pw) = 0 Then
  MsgBox "No se escribio ninguna contrasena. No se guardo nada.", vbExclamation, "VibraTok"
  WScript.Quit 1
End If
pw = Replace(pw, " ", "")
folder = sh.ExpandEnvironmentStrings("%APPDATA%") & "\VibraTokData"
If Not fso.FolderExists(folder) Then fso.CreateFolder(folder)
target = folder & "\smtp-config.json"
json = "{" & vbCrLf & _
  "  ""host"": ""smtp.gmail.com""," & vbCrLf & _
  "  ""port"": 465," & vbCrLf & _
  "  ""secure"": true," & vbCrLf & _
  "  ""user"": """ & email & """," & vbCrLf & _
  "  ""pass"": """ & Replace(Replace(pw, "\", "\\"), """", "\""") & """," & vbCrLf & _
  "  ""from"": ""VibraTok <" & email & ">""," & vbCrLf & _
  "  ""service"": ""gmail""" & vbCrLf & "}"
Set f = fso.CreateTextFile(target, True, True)
f.Write json
f.Close
pw = ""
MsgBox "Configuracion guardada." & vbCrLf & vbCrLf & "Ahora cierra VibraTok COMPLETAMENTE y vuelve a abrirlo." & vbCrLf & "Despues prueba enviar un codigo a un correo tuyo.", vbInformation, "VibraTok"
