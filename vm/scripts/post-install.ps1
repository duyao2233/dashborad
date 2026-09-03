$ErrorActionPreference = 'Continue'
$log = 'C:\setup\post-install.log'
function Log($msg) { "$(Get-Date -Format o) $msg" | Out-File -Append $log }

Log 'Starting post-install setup'

# Install VirtIO drivers from virtio-win ISO (drive D: or E:)
$virtioDrives = Get-Volume | Where-Object { $_.FileSystemLabel -match 'virtio' -or (Test-Path "$($_.DriveLetter):\NetKVM") }
foreach ($vol in $virtioDrives) {
    $letter = $vol.DriveLetter
    if (-not $letter) { continue }
    $root = "$letter`:\"
    Log "Checking virtio drive $root"
    if (Test-Path "$root\virtio-win-gt-x64.msi") {
        Log 'Installing virtio guest tools'
        Start-Process msiexec.exe -ArgumentList '/i', "$root\virtio-win-gt-x64.msi", '/qn', '/norestart' -Wait
    }
    $netkvm = Get-ChildItem -Path $root -Recurse -Filter 'netkvm.inf' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($netkvm) {
        Log "Installing NetKVM driver from $($netkvm.DirectoryName)"
        pnputil /add-driver "$($netkvm.FullName)" /install | Out-File -Append $log
    }
}

# Enable RDP and firewall
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name 'fDenyTSConnections' -Value 0
Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'

# Install .NET 3.5 (required by many legacy clinic apps)
Log 'Installing .NET Framework 3.5'
DISM /Online /Enable-Feature /FeatureName:NetFx3 /All /NoRestart | Out-File -Append $log

# Download and install SQL Server 2022 Express
$sqlUrl = 'https://go.microsoft.com/fwlink/?linkid=2215160'
$sqlInstaller = 'C:\setup\SQL2022-SSEI-Expr.exe'
if (-not (Test-Path $sqlInstaller)) {
    Log 'Downloading SQL Server 2022 Express installer'
    Invoke-WebRequest -Uri $sqlUrl -OutFile $sqlInstaller -UseBasicParsing
}

$sqlConfig = @'
[OPTIONS]
ACTION="Install"
QUIET="True"
FEATURES=SQLENGINE
INSTANCENAME="SQLEXPRESS"
SQLSVCACCOUNT="NT AUTHORITY\NETWORK SERVICE"
SQLSYSADMINACCOUNTS="BUILTIN\Administrators"
TCPENABLED="1"
NPENABLED="0"
IACCEPTSQLSERVERLICENSETERMS="True"
'@
$sqlConfig | Out-File -Encoding ASCII 'C:\setup\sql-express.ini'
if (-not (Get-Service -Name 'MSSQL$SQLEXPRESS' -ErrorAction SilentlyContinue)) {
    Log 'Installing SQL Server Express'
    Start-Process -FilePath $sqlInstaller -ArgumentList '/ConfigurationFile=C:\setup\sql-express.ini' -Wait
}

# Download Junke clinic management software from official site
$junkeUrl = 'http://www.juncnet.com/upload/soft/mzglxt.exe'
$junkeInstaller = 'C:\setup\junke-mzglxt.exe'
if (-not (Test-Path $junkeInstaller)) {
    Log 'Downloading Junke clinic management software'
    try {
        Invoke-WebRequest -Uri $junkeUrl -OutFile $junkeInstaller -UseBasicParsing
    } catch {
        Log "Failed to download from official site: $_"
        # Fallback: try alternate official path
        $altUrl = 'http://juncnet.com/upload/soft/mzglxt.exe'
        Invoke-WebRequest -Uri $altUrl -OutFile $junkeInstaller -UseBasicParsing
    }
}

if (Test-Path $junkeInstaller) {
    Log 'Installing Junke clinic management software'
    Start-Process -FilePath $junkeInstaller -ArgumentList '/S' -Wait -ErrorAction SilentlyContinue
    if (-not $?) {
        Start-Process -FilePath $junkeInstaller -Wait
    }
}

# Create desktop shortcut info file
@"
君科门诊管理系统 Demo 环境
============================
服务器: localhost\SQLEXPRESS
管理员密码: QWErty123!
远程桌面: 已启用
安装日志: C:\setup\post-install.log

软件安装完成后，请从开始菜单启动「君科门诊管理系统」。
"@ | Out-File -Encoding UTF8 'C:\Users\Public\Desktop\README.txt'

Log 'Post-install setup completed'
# Disable autologon after setup
Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name 'AutoAdminLogon' -ErrorAction SilentlyContinue
