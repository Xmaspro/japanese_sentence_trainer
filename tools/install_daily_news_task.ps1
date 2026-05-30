$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$node = (Get-Command node).Source
$script = Join-Path $repo "tools\daily_news_fetcher.js"
$taskName = "JapaneseSentenceTrainerDailyNews"

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Fetch mainstream Japanese news for Japanese sentence trainer every morning." -Force | Out-Null

Write-Host "Installed scheduled task: $taskName"
