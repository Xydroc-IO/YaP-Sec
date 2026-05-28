import tkinter as tk
from tkinter import scrolledtext, font
import subprocess
import threading
import os
import shutil
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

class YaPsecLauncher(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("YaPsec - GUI Launcher")
        self.geometry("800x600")
        self.configure(bg="#1e1e2e")
        
        try:
            icon_path = os.path.join(ROOT_DIR, "..", "Icon.png")
            icon_img = tk.PhotoImage(file=icon_path)
            self.iconphoto(True, icon_img)
        except Exception as e:
            print(f"Could not load icon: {e}")
        
        self.process = None
        
        # Header
        header = tk.Label(self, text="YaPsec - Launcher", font=("Helvetica", 18, "bold"), bg="#1e1e2e", fg="#f38ba8")
        header.pack(pady=15)
        
        # Buttons Frame
        btn_frame = tk.Frame(self, bg="#1e1e2e")
        btn_frame.pack(pady=10)
        
        btn_style = {"font": ("Helvetica", 10, "bold"), "fg": "#11111b", "width": 18, "pady": 5}
        
        self.btn_auto = tk.Button(btn_frame, text="Auto Setup", command=self.auto_setup, bg="#a6e3a1", **btn_style)
        self.btn_auto.grid(row=0, column=0, padx=10)
        
        self.btn_run = tk.Button(btn_frame, text="Run & Open Dashboard", command=self.run_app, bg="#f9e2af", **btn_style)
        self.btn_run.grid(row=0, column=1, padx=10)
        
        self.btn_stop = tk.Button(btn_frame, text="Stop Server", command=self.stop_process, bg="#f38ba8", **btn_style)
        self.btn_stop.grid(row=0, column=2, padx=10)
        
        # Console output
        console_frame = tk.Frame(self, bg="#1e1e2e")
        console_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        self.console = scrolledtext.ScrolledText(console_frame, bg="#11111b", fg="#cdd6f4", font=("Consolas", 10))
        self.console.pack(fill=tk.BOTH, expand=True)
        
        self.log("--- YaPsec GUI Launcher Ready ---\n\n")
        self.log("Welcome to YaPsec! Here is how to use the launcher:\n\n")
        self.log("  [ Auto Setup ]\n")
        self.log("     Use this when you first install the project or pull new updates.\n")
        self.log("     It will securely check for missing dependencies, update your\n")
        self.log("     packages, install Python/NPM requirements, and start the app.\n\n")
        self.log("  [ Run & Open Dashboard ]\n")
        self.log("     Use this for day-to-day hacking. It skips the slow dependency\n")
        self.log("     checks and instantly spins up the backend and frontend servers.\n\n")
        self.log("Click a button above to begin.\n\n")

    def log(self, text):
        self.console.insert(tk.END, text)
        self.console.see(tk.END)
        
    def _read_output(self, proc):
        for line in iter(proc.stdout.readline, ''):
            if not line: break
            self.log(line)
        proc.stdout.close()
        self.log("\n[!] Process exited.\n")
        
    def run_script(self, script_name, open_browser=False):
        self.stop_process()
        self.log(f"\n--- Running {script_name} ---\n")
        script_path = os.path.join(ROOT_DIR, script_name)
        
        self.process = subprocess.Popen(
            ["bash", script_path], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            bufsize=1,
            cwd=ROOT_DIR,
            preexec_fn=os.setsid # allows us to kill the whole process group
        )
        
        threading.Thread(target=self._read_output, args=(self.process,), daemon=True).start()
        
        if open_browser:
            self.log("[*] Opening browser in 3 seconds...\n")
            self.after(3000, lambda: webbrowser.open("http://localhost:5173"))
            


    def auto_setup(self):
        self.run_script("auto_setup_and_launch.sh", open_browser=True)

    def run_app(self):
        self.run_script("run.sh", open_browser=True)
        
    def stop_process(self):
        if self.process and self.process.poll() is None:
            self.log("\n[!] Stopping server and background processes...\n")
            import signal
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            except Exception as e:
                self.log(f"Error stopping process: {e}\n")
            self.process.wait()
            self.log("[!] Stopped.\n")

if __name__ == "__main__":
    app = YaPsecLauncher()
    app.mainloop()
