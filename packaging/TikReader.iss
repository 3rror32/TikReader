#define AppVersion "1.0.0.7"
[Setup]
AppId={{1C075AC1-8E70-4990-A7BC-C4A597BE3972}
AppName=TikReader Beta
AppVersion={#AppVersion}
AppVerName=TikReader {#AppVersion} Beta
AppPublisher=3rror32
DefaultDirName={localappdata}\Programs\TikReader
DefaultGroupName=TikReader
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\release
OutputBaseFilename=TikReader-{#AppVersion}-Beta-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\icons\tikreader.ico
UninstallDisplayIcon={app}\assets\icons\tikreader.ico
CloseApplications=no
RestartApplications=no
DisableProgramGroupPage=yes
InfoBeforeFile=installer-info.txt

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; Flags: unchecked

[Files]
Source: "..\release\TikReader\*"; DestDir: "{app}"; Excludes: "__pycache__,*.pyc"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ".env.example"; DestDir: "{localappdata}\TikReader"; DestName: ".env"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{group}\TikReader"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\desktop_launch.pyw"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\icons\tikreader.ico"
Name: "{autodesktop}\TikReader"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\desktop_launch.pyw"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\icons\tikreader.ico"; Tasks: desktopicon
Name: "{group}\Desinstalar TikReader"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\desktop_launch.pyw"""; Description: "Abrir TikReader"; Flags: nowait postinstall skipifsilent

[Code]
var
  PreviousCopy: TInputQueryWizardPage;
  PreviousBrowse: TNewButton;

procedure BrowsePreviousCopy(Sender: TObject);
var Folder: String;
begin
  Folder := Trim(PreviousCopy.Values[0]);
  if BrowseForFolder('Selecciona la carpeta anterior de TikReader', Folder, False) then
    PreviousCopy.Values[0] := Folder;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var Folder: String;
begin
  Result := True;
  if CurPageID <> PreviousCopy.ID then Exit;
  Folder := Trim(PreviousCopy.Values[0]);
  PreviousCopy.Values[0] := Folder;
  if Folder = '' then Exit;
  Result := ((Copy(Folder, 1, 2) = '\\') or
    ((Length(Folder) >= 3) and (Copy(Folder, 2, 2) = ':\'))) and DirExists(Folder);
  if not Result then
    MsgBox('Selecciona una carpeta existente con una ruta completa, o deja el campo vacío para una instalación nueva.', mbError, MB_OK);
end;

procedure InitializeWizard();
begin
  { InputDir pages reject empty paths before optional validation can run. }
  PreviousCopy := CreateInputQueryPage(wpSelectDir, 'Datos de una versión anterior',
    'Opcional: copiar historial, ajustes y modelos personales',
    'Si tienes una copia anterior, selecciona su carpeta. Déjalo vacío para una instalación nueva. El original se conserva; no se sobrescriben datos existentes.');
  PreviousCopy.Add('Carpeta anterior de TikReader:', False);
  PreviousBrowse := TNewButton.Create(PreviousCopy);
  PreviousBrowse.Parent := PreviousCopy.Surface;
  PreviousBrowse.Caption := 'Examinar...';
  PreviousBrowse.Width := ScaleX(85);
  PreviousBrowse.Height := WizardForm.NextButton.Height;
  PreviousBrowse.Left := PreviousCopy.SurfaceWidth - PreviousBrowse.Width;
  PreviousBrowse.Top := PreviousCopy.Edits[0].Top;
  PreviousBrowse.OnClick := @BrowsePreviousCopy;
  PreviousCopy.Edits[0].Width := PreviousBrowse.Left - ScaleX(8);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var ExitCode: Integer;
begin
  if (CurStep = ssPostInstall) and (PreviousCopy.Values[0] <> '') then
  begin
    if (not Exec(ExpandConstant('{app}\python\python.exe'),
      '"' + ExpandConstant('{app}\app\migrate_previous.py') + '" "' + RemoveBackslashUnlessRoot(PreviousCopy.Values[0]) + '"',
      ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode)) or (ExitCode <> 0) then
      MsgBox('No se importaron los datos. Verifica que la copia anterior esté cerrada y que no existan datos en el destino. La carpeta original se conserva.', mbError, MB_OK);
  end;
end;

function ServerRunning(): Boolean;
var Request: Variant; ExitCode, StatusCode: Integer; ResponseBody: String;
begin
  Result := False;
  if FileExists(ExpandConstant('{app}\app\installation_check.py')) then
  begin
    if not Exec(ExpandConstant('{app}\python\python.exe'),
      '"' + ExpandConstant('{app}\app\installation_check.py') + '"',
      ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      Result := True
    else
      Result := ExitCode <> 0;
    if Result then Exit;
  end;
  try
    Request := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Request.SetTimeouts(1000, 1000, 1000, 1000);
    Request.Open('GET', 'http://127.0.0.1:5000/health', False);
    Request.Send();
    StatusCode := Request.Status;
    ResponseBody := Request.ResponseText;
    Result := (StatusCode = 200) and (Pos('TikReader', ResponseBody) > 0);
  except
  end;
end;

function CloseRunningServer(): Boolean;
var Request: Variant; Attempt, StatusCode: Integer; ResponseBody: String;
begin
  Result := False;
  try
    Request := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Request.SetTimeouts(1000, 1000, 1000, 5000);
    Request.Open('GET', 'http://127.0.0.1:5000/health', False);
    Request.Send();
    StatusCode := Request.Status;
    ResponseBody := Request.ResponseText;
    if (StatusCode <> 200) or
      (Pos('TikReader', ResponseBody) = 0) then Exit;
    Request.Open('POST', 'http://127.0.0.1:5000/system/exit', False);
    Request.SetRequestHeader('Content-Type', 'application/json');
    Request.Send('{"confirm":true}');
    if Request.Status <> 200 then Exit;
    for Attempt := 1 to 30 do
    begin
      Sleep(500);
      if not ServerRunning() then
      begin
        Result := True;
        Exit;
      end;
    end;
  except
    Log('No se pudo cerrar TikReader mediante su servicio local.');
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not ServerRunning() then Exit;
  if not WizardSilent() then
    if MsgBox('TikReader sigue abierto en segundo plano. ¿Quieres cerrarlo y continuar con la instalación? Se desconectará del LIVE y tus datos se conservarán.',
      mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      if CloseRunningServer() then Exit;
  Result := 'TikReader sigue abierto. Ciérralo desde Acerca de > Cerrar TikReader y vuelve a intentar. Si está instalando voces, espera a que termine. Tus datos se conservarán.';
end;

function InitializeUninstall(): Boolean;
begin
  Result := not ServerRunning();
  if not Result then
    MsgBox('Cierra TikReader desde Acerca de > Cerrar TikReader antes de desinstalar.', mbInformation, MB_OK);
end;
