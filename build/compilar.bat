@echo off
setlocal
cd /d "%~dp0"

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo csc.exe nao encontrado. Instale o .NET Framework 4.x.
  exit /b 1
)

"%CSC%" /nologo /target:winexe /optimize+ /win32icon:"..\crm.ico" /r:System.Management.dll /r:System.Windows.Forms.dll /out:"CRMCloser.exe" "launcher.cs"
if errorlevel 1 exit /b 1

echo CRMCloser.exe gerado em build\CRMCloser.exe
