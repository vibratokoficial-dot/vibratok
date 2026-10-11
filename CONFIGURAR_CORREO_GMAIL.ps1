Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'VibraTok - Configurar correo'
$form.Size = New-Object System.Drawing.Size(500,230)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$label = New-Object System.Windows.Forms.Label
$label.Text = "Pega la contraseña de aplicación de Gmail:`r`n(Remítete a vibratokoficial@gmail.com; no uses tu contraseña normal.)"
$label.Location = New-Object System.Drawing.Point(18,18)
$label.Size = New-Object System.Drawing.Size(450,48)
$form.Controls.Add($label)
$box = New-Object System.Windows.Forms.TextBox
$box.Location = New-Object System.Drawing.Point(20,78)
$box.Size = New-Object System.Drawing.Size(440,25)
$box.UseSystemPasswordChar = $true
$form.Controls.Add($box)
$show = New-Object System.Windows.Forms.CheckBox
$show.Text = 'Mostrar contraseña mientras escribo'
$show.Location = New-Object System.Drawing.Point(20,110)
$show.Size = New-Object System.Drawing.Size(280,22)
$show.Add_CheckedChanged({ $box.UseSystemPasswordChar = -not $show.Checked })
$form.Controls.Add($show)
$ok = New-Object System.Windows.Forms.Button
$ok.Text = 'Guardar'
$ok.Location = New-Object System.Drawing.Point(275,150)
$ok.Size = New-Object System.Drawing.Size(85,30)
$ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($ok)
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = 'Cancelar'
$cancel.Location = New-Object System.Drawing.Point(370,150)
$cancel.Size = New-Object System.Drawing.Size(85,30)
$cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancel)
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$box.Focus() | Out-Null
$result = $form.ShowDialog()
if ($result -ne [System.Windows.Forms.DialogResult]::OK -or [string]::IsNullOrWhiteSpace($box.Text)) { exit 2 }
$pass = $box.Text.Trim() -replace '\s',''
$base = $env:VIBRATOK_DATA_DIR
if ([string]::IsNullOrWhiteSpace($base)) { $base = Join-Path $env:APPDATA 'VibraTokData' }
New-Item -ItemType Directory -Path $base -Force | Out-Null
$config = [ordered]@{ host='smtp.gmail.com'; port=465; secure=$true; user='vibratokoficial@gmail.com'; pass=$pass; from='VibraTok <vibratokoficial@gmail.com>'; service='gmail' }
$target = Join-Path $base 'smtp-config.json'
$config | ConvertTo-Json | Set-Content -LiteralPath $target -Encoding UTF8
$check = Get-Content -LiteralPath $target -Raw | ConvertFrom-Json
if ($check.user -ne 'vibratokoficial@gmail.com' -or [string]::IsNullOrWhiteSpace($check.pass)) { throw 'No se pudo verificar el archivo guardado.' }
[System.Windows.Forms.MessageBox]::Show("Contraseña guardada correctamente.`r`nCierra VibraTok por completo y vuelve a abrirlo.", 'VibraTok', 'OK', 'Information') | Out-Null
