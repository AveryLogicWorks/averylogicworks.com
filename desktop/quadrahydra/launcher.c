/* Copyright (c) 2026 Avery Logic Works. All rights reserved.
 * Windows GUI launcher. No Python or development tools needed on the user's PC.
 */
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <stdio.h>
#include <wchar.h>

#define PATH_CAP 32768

static int fail(const wchar_t *message, DWORD error) {
    wchar_t buffer[2048];
    swprintf(buffer, 2048, L"%ls\n\nWindows error: %lu", message, (unsigned long)error);
    MessageBoxW(NULL, buffer, L"QuadraHydra could not start", MB_OK | MB_ICONERROR);
    return 1;
}

static BOOL make_directory(const wchar_t *path) {
    if (CreateDirectoryW(path, NULL)) return TRUE;
    return GetLastError() == ERROR_ALREADY_EXISTS;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR command, int show) {
    (void)instance; (void)previous; (void)command; (void)show;
    static wchar_t app[PATH_CAP], script[PATH_CAP], powershell[PATH_CAP];
    static wchar_t data[MAX_PATH], logs[MAX_PATH], log_file[MAX_PATH];
    static wchar_t arguments[PATH_CAP];
    DWORD length = GetModuleFileNameW(NULL, app, PATH_CAP);
    if (!length || length >= PATH_CAP) return fail(L"The application path is too long.", GetLastError());
    wchar_t *slash = wcsrchr(app, L'\\');
    if (!slash) return fail(L"The application directory could not be found.", ERROR_PATH_NOT_FOUND);
    *slash = 0;
    if (wcslen(app) > 12000) return fail(L"Please extract QuadraHydra to a shorter folder path.", ERROR_FILENAME_EXCED_RANGE);
    swprintf(script, PATH_CAP, L"%ls\\QuadraHydra-Start.ps1", app);
    if (GetFileAttributesW(script) == INVALID_FILE_ATTRIBUTES)
        return fail(L"QuadraHydra-Start.ps1 is missing. Extract the entire ZIP before opening QuadraHydra.exe.", ERROR_FILE_NOT_FOUND);

    BOOL elevated = FALSE;
    int argc = 0;
    LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (!argv) return fail(L"The launch arguments could not be read.", GetLastError());
    for (int i = 1; i < argc; ++i) {
        if (!_wcsicmp(argv[i], L"-AdminActivated")) elevated = TRUE;
        else { LocalFree(argv); return fail(L"Unsupported launch option.", ERROR_BAD_ARGUMENTS); }
    }
    LocalFree(argv);

    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, SHGFP_TYPE_CURRENT, data)))
        return fail(L"Your local application data folder could not be found.", ERROR_PATH_NOT_FOUND);
    if (wcslen(data) > MAX_PATH - 110) return fail(L"The application data path is too long.", ERROR_FILENAME_EXCED_RANGE);
    wcscat(data, L"\\AveryLogicWorks");
    if (!make_directory(data)) return fail(L"Could not create the local settings folder.", GetLastError());
    wcscat(data, L"\\QuadraHydra");
    if (!make_directory(data)) return fail(L"Could not create the local settings folder.", GetLastError());
    swprintf(logs, MAX_PATH, L"%ls\\Logs", data);
    if (!make_directory(logs)) return fail(L"Could not create the local log folder.", GetLastError());
    SYSTEMTIME now;
    GetLocalTime(&now);
    swprintf(log_file, MAX_PATH, L"%ls\\launch-%04u%02u%02u-%02u%02u%02u-%lu.log", logs,
             now.wYear, now.wMonth, now.wDay, now.wHour, now.wMinute, now.wSecond, (unsigned long)GetCurrentProcessId());
    SECURITY_ATTRIBUTES security = { sizeof(SECURITY_ATTRIBUTES), NULL, TRUE };
    HANDLE log = CreateFileW(log_file, GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
                            &security, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (log == INVALID_HANDLE_VALUE) return fail(L"Could not open the launch log.", GetLastError());
    HANDLE input = CreateFileW(L"NUL", GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                              &security, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
    if (input == INVALID_HANDLE_VALUE) { DWORD error = GetLastError(); CloseHandle(log); return fail(L"Could not initialize PowerShell input.", error); }

    if (!GetSystemDirectoryW(powershell, PATH_CAP - 64)) {
        DWORD error = GetLastError(); CloseHandle(input); CloseHandle(log);
        return fail(L"The Windows system directory could not be found.", error);
    }
    wcscat(powershell, L"\\WindowsPowerShell\\v1.0\\powershell.exe");
    int count = swprintf(arguments, PATH_CAP,
        L"\"%ls\" -NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%ls\" -AppDirectory \"%ls\" -LogPath \"%ls\" %ls",
        powershell, script, app, log_file, elevated ? L"-AdminActivated" : L"");
    if (count < 0 || count >= PATH_CAP) {
        CloseHandle(input); CloseHandle(log);
        return fail(L"The launch command is too long. Extract to a shorter path.", ERROR_FILENAME_EXCED_RANGE);
    }
    STARTUPINFOW startup = {0};
    PROCESS_INFORMATION process = {0};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESHOWWINDOW | STARTF_USESTDHANDLES;
    startup.wShowWindow = SW_HIDE;
    startup.hStdInput = input;
    startup.hStdOutput = log;
    startup.hStdError = log;
    BOOL started = CreateProcessW(powershell, arguments, NULL, NULL, TRUE,
        CREATE_NO_WINDOW | NORMAL_PRIORITY_CLASS, NULL, app, &startup, &process);
    DWORD start_error = GetLastError();
    CloseHandle(input);
    CloseHandle(log);
    if (!started) return fail(L"Windows PowerShell could not start. QuadraHydra requires Windows PowerShell 5.1.", start_error);
    CloseHandle(process.hThread);
    WaitForSingleObject(process.hProcess, INFINITE);
    DWORD exit_code = 1;
    GetExitCodeProcess(process.hProcess, &exit_code);
    CloseHandle(process.hProcess);
    if (exit_code != 0) {
        static wchar_t message[PATH_CAP];
        swprintf(message, PATH_CAP, L"QuadraHydra closed with an error. Diagnostic details are saved here:\n\n%ls", log_file);
        MessageBoxW(NULL, message, L"QuadraHydra", MB_OK | MB_ICONWARNING);
    }
    return (int)exit_code;
}
