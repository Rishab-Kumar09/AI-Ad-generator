# Installing FFmpeg on Windows

FFmpeg is required for video generation. Follow these steps:

## Option 1: Using Chocolatey (Recommended - Easiest)

1. Open PowerShell as Administrator
2. If you don't have Chocolatey, install it first:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

3. Install FFmpeg:
```powershell
choco install ffmpeg
```

4. Restart your terminal and verify:
```powershell
ffmpeg -version
```

## Option 2: Manual Installation

1. Download FFmpeg from: https://www.gyan.dev/ffmpeg/builds/
   - Click "ffmpeg-release-essentials.zip"

2. Extract the ZIP file to: `C:\ffmpeg`

3. Add to PATH:
   - Press `Windows + R`
   - Type `sysdm.cpl` and press Enter
   - Go to "Advanced" tab → "Environment Variables"
   - Under "System Variables", find "Path" and click "Edit"
   - Click "New" and add: `C:\ffmpeg\bin`
   - Click "OK" on all windows

4. Restart your terminal and verify:
```powershell
ffmpeg -version
```

## Option 3: Using Winget (Windows 10/11)

```powershell
winget install Gyan.FFmpeg
```

## After Installation

Once FFmpeg is installed:
1. Restart your PowerShell windows
2. Run: `npm run dev` again
3. Test video generation in AdForge!

## Verify Installation

Open a new PowerShell and run:
```powershell
ffmpeg -version
```

You should see FFmpeg version information!

