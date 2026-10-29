using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Program
{
    private const string AppName = "CRM Closer";
    private const int BasePort = 3200;
    private const int MaxPort = 3209;

    private static string BaseDir
    {
        get { return AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar); }
    }

    private static string DataDir
    {
        get
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CRM Closer",
                "data");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    [STAThread]
    private static void Main(string[] args)
    {
        bool silent = HasArg(args, "--silent");
        bool stop = HasArg(args, "--stop");

        try
        {
            if (stop)
            {
                StopServer(silent);
                return;
            }

            string url = FindServer();
            if (url == null)
            {
                StartServer();
                url = WaitForServer(25000);
            }

            if (url == null)
            {
                Log("Nao foi possivel iniciar o servidor.");
                if (!silent)
                    MessageBox.Show(
                        "Nao foi possivel iniciar o CRM Closer.\n\nVeja o log em:\n" + Path.Combine(DataDir, "server.log"),
                        AppName,
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                return;
            }

            if (!silent)
                OpenBrowser(url);
        }
        catch (Exception ex)
        {
            Log("Erro: " + ex);
            if (!silent)
                MessageBox.Show(
                    "Erro ao iniciar o CRM Closer:\n\n" + ex.Message,
                    AppName,
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
        }
    }

    private static bool HasArg(string[] args, string name)
    {
        foreach (string a in args)
        {
            if (string.Equals(a, name, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static void Log(string message)
    {
        try
        {
            File.AppendAllText(
                Path.Combine(DataDir, "launcher.log"),
                "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message + Environment.NewLine);
        }
        catch { }
    }

    private static string FindServer()
    {
        for (int port = BasePort; port <= MaxPort; port++)
        {
            if (IsCrm(port))
                return "http://127.0.0.1:" + port.ToString();
        }
        return null;
    }

    private static bool IsCrm(int port)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(
                "http://127.0.0.1:" + port.ToString() + "/api/health");
            request.Proxy = null;
            request.Timeout = 700;
            request.ReadWriteTimeout = 700;
            request.Method = "GET";

            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                string body = reader.ReadToEnd();
                return body.IndexOf("\"app\":\"crm-closer\"", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch
        {
            return false;
        }
    }

    private static void StartServer()
    {
        string node = Path.Combine(BaseDir, "runtime", "node.exe");
        if (!File.Exists(node))
            node = @"C:\Program Files\nodejs\node.exe";
        if (!File.Exists(node))
            throw new FileNotFoundException("Node.js nao encontrado em runtime\\node.exe.");

        ProcessStartInfo info = new ProcessStartInfo();
        info.FileName = node;
        info.Arguments = "\"" + Path.Combine(BaseDir, "server.js") + "\"";
        info.WorkingDirectory = BaseDir;
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.WindowStyle = ProcessWindowStyle.Hidden;
        info.EnvironmentVariables["CRM_DATA_DIR"] = DataDir;
        info.EnvironmentVariables["PORT"] = BasePort.ToString();

        Process.Start(info);
        Log("Servidor iniciado com " + node);
    }

    private static string WaitForServer(int timeoutMs)
    {
        int waited = 0;
        while (waited < timeoutMs)
        {
            string url = FindServer();
            if (url != null)
                return url;
            Thread.Sleep(400);
            waited += 400;
        }
        return null;
    }

    private static void StopServer(bool silent)
    {
        bool stopped = false;
        string pidFile = Path.Combine(DataDir, "server.pid");

        try
        {
            if (File.Exists(pidFile))
            {
                int pid;
                if (int.TryParse(File.ReadAllText(pidFile).Trim(), out pid))
                {
                    if (IsOurServer(pid))
                    {
                        try
                        {
                            Process process = Process.GetProcessById(pid);
                            if (!process.HasExited)
                            {
                                process.Kill();
                                process.WaitForExit(5000);
                                stopped = true;
                            }
                        }
                        catch { }
                    }
                }
                try { File.Delete(pidFile); } catch { }
            }
        }
        catch { }

        if (!stopped)
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='node.exe'"))
                {
                    foreach (ManagementObject item in searcher.Get())
                    {
                        string commandLine = Convert.ToString(item["CommandLine"]);
                        if (commandLine.IndexOf("server.js", StringComparison.OrdinalIgnoreCase) >= 0 &&
                            commandLine.IndexOf(BaseDir, StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            int pid = Convert.ToInt32(item["ProcessId"]);
                            try
                            {
                                Process process = Process.GetProcessById(pid);
                                if (!process.HasExited)
                                {
                                    process.Kill();
                                    process.WaitForExit(5000);
                                    stopped = true;
                                }
                            }
                            catch { }
                        }
                    }
                }
            }
            catch { }
        }

        Log(stopped ? "Servidor parado." : "Nenhum servidor em execucao.");
        if (!silent)
            MessageBox.Show(
                stopped ? "CRM Closer parado." : "O CRM Closer nao estava rodando.",
                AppName,
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
    }

    private static bool IsOurServer(int pid)
    {
        try
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                "SELECT ProcessId, CommandLine FROM Win32_Process WHERE ProcessId=" + pid.ToString()))
            {
                foreach (ManagementObject item in searcher.Get())
                {
                    string commandLine = Convert.ToString(item["CommandLine"]);
                    return commandLine.IndexOf("server.js", StringComparison.OrdinalIgnoreCase) >= 0 &&
                           commandLine.IndexOf(BaseDir, StringComparison.OrdinalIgnoreCase) >= 0;
                }
            }
        }
        catch { }

        try
        {
            Process process = Process.GetProcessById(pid);
            return string.Equals(process.ProcessName, "node", StringComparison.OrdinalIgnoreCase);
        }
        catch { }

        return false;
    }

    private static void OpenBrowser(string url)
    {
        string chrome = FindChrome();
        if (chrome != null)
        {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = chrome;
            info.Arguments = "--app=" + url + " --window-size=1400,900";
            info.UseShellExecute = false;
            Process.Start(info);
            return;
        }

        ProcessStartInfo fallback = new ProcessStartInfo();
        fallback.FileName = url;
        fallback.UseShellExecute = true;
        Process.Start(fallback);
    }

    private static string FindChrome()
    {
        string[] paths = new string[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
        };

        foreach (string path in paths)
        {
            if (File.Exists(path))
                return path;
        }

        try
        {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"))
            {
                if (key != null)
                {
                    string path = key.GetValue(null) as string;
                    if (!string.IsNullOrEmpty(path) && File.Exists(path))
                        return path;
                }
            }

            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"))
            {
                if (key != null)
                {
                    string path = key.GetValue(null) as string;
                    if (!string.IsNullOrEmpty(path) && File.Exists(path))
                        return path;
                }
            }
        }
        catch { }

        return null;
    }
}
