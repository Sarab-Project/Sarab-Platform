Start-Sleep -Seconds 2
try {
  $body = @{ email='admin@sarab.com'; password='admin' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5027/api/auth/login' -ContentType 'application/json' -Body $body -ErrorAction Stop
  $token = $login.Token
  Write-Output "LOGIN_SUCCESS: $token"
} catch {
  Write-Output "LOGIN_FAILED: $($_.Exception.Message)"
  exit 1
}
try {
  $groups = Invoke-RestMethod -Uri 'http://localhost:5027/api/groups' -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
  Write-Output "GROUPS:"
  $groups | ConvertTo-Json -Depth 5 | Write-Output
} catch {
  Write-Output "GROUPS_FAILED: $($_.Exception.Message)"
}
$g = $groups | Select-Object -First 1
if ($null -eq $g) { Write-Output 'NO_GROUPS'; exit 0 }
$memberToRemove = $g.Members | Where-Object { $_.Role -ne 0 } | Select-Object -First 1
if ($null -eq $memberToRemove) { Write-Output 'NO_REMOVABLE_MEMBER'; exit 0 }
$userId = $memberToRemove.User.Id
Write-Output "Attempting to remove member $userId from group $($g.Id)"
try {
  $res = Invoke-RestMethod -Method Delete -Uri "http://localhost:5027/api/groups/$($g.Id)/members/$userId" -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
  Write-Output "REMOVE_RESULT:"
  $res | ConvertTo-Json -Depth 5 | Write-Output
} catch {
  Write-Output "REMOVE_FAILED: $($_.Exception.Message)"
}
$detail = Invoke-RestMethod -Uri "http://localhost:5027/api/groups/$($g.Id)" -Headers @{ Authorization = "Bearer $token" }
Write-Output "GROUP_AFTER_REMOVE:"
$detail | ConvertTo-Json -Depth 5 | Write-Output
