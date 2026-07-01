$file = '.env.example'
if (Test-Path $file) {
  (Get-Content $file) -replace 'AQ\.Ab8RN6IlpidoSsDVS7VVz_ItU9cJdTgWLFiihfkYSfp9jRYiMQ', '' | Set-Content $file
}
exit 0
