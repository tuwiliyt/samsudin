import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Background Process Manager for Samsudin Agent Harness.
 * Allows launching, monitoring, tailing logs, and killing background jobs
 * (e.g. web servers, docker daemons, compilation watchers, long-running scripts).
 */
export class ProcessManager {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.tasksDir = path.resolve(this.cwd, '.samsudin', 'tasks');
    this.registryFile = path.resolve(this.tasksDir, 'registry.json');
    this.tasks = new Map();
    this.loadRegistry();
  }

  ensureDir() {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
  }

  loadRegistry() {
    try {
      if (fs.existsSync(this.registryFile)) {
        const raw = fs.readFileSync(this.registryFile, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            this.tasks.set(item.taskId, item);
          }
        }
      }
    } catch {}
  }

  saveRegistry() {
    try {
      this.ensureDir();
      const list = Array.from(this.tasks.values());
      fs.writeFileSync(this.registryFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch {}
  }

  isProcessAlive(pid) {
    if (!pid || typeof pid !== 'number') return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  spawnTask({ command, cwd = this.cwd }) {
    this.ensureDir();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logFile = path.resolve(this.tasksDir, `${taskId}.log`);

    const logFd = fs.openSync(logFile, 'a');

    const child = spawn('/bin/bash', ['-c', command], {
      cwd: cwd || this.cwd,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        DEBIAN_FRONTEND: 'noninteractive',
        PAGER: 'cat',
        GIT_PAGER: 'cat',
        TERM: 'dumb',
        CI: '1',
        LC_ALL: 'C.UTF-8'
      }
    });

    const pid = child.pid;
    child.unref();

    const taskRecord = {
      taskId,
      pid,
      command,
      cwd: cwd || this.cwd,
      logFile,
      startTime: new Date().toISOString(),
      status: 'RUNNING',
      exitCode: null
    };

    child.on('close', (code) => {
      taskRecord.status = 'EXITED';
      taskRecord.exitCode = code;
      taskRecord.endTime = new Date().toISOString();
      this.saveRegistry();
      try {
        fs.closeSync(logFd);
      } catch {}
    });

    this.tasks.set(taskId, taskRecord);
    this.saveRegistry();

    return {
      success: true,
      isBackground: true,
      taskId,
      pid,
      command,
      logFile,
      status: 'RUNNING',
      message: `Process started in background (PID: ${pid}). Use process_manager to inspect logs or check status.`
    };
  }

  listTasks() {
    const results = [];
    for (const task of this.tasks.values()) {
      if (task.status === 'RUNNING') {
        const alive = this.isProcessAlive(task.pid);
        if (!alive) {
          task.status = 'EXITED';
        }
      }
      results.push({ ...task });
    }
    this.saveRegistry();
    return results;
  }

  getLogs({ taskId, lines = 50 }) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!fs.existsSync(task.logFile)) {
      return { taskId, logs: '(no log output yet)', totalLines: 0 };
    }

    const content = fs.readFileSync(task.logFile, 'utf-8');
    const allLines = content.split('\n');
    const tailLines = allLines.slice(-Math.max(1, lines));

    return {
      taskId,
      pid: task.pid,
      command: task.command,
      status: this.isProcessAlive(task.pid) ? 'RUNNING' : 'EXITED',
      logFile: task.logFile,
      totalLines: allLines.length,
      linesShown: tailLines.length,
      logs: tailLines.join('\n')
    };
  }

  getStatus({ taskId }) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const alive = this.isProcessAlive(task.pid);
    if (!alive && task.status === 'RUNNING') {
      task.status = 'EXITED';
      this.saveRegistry();
    }

    return {
      taskId,
      pid: task.pid,
      command: task.command,
      status: alive ? 'RUNNING' : 'EXITED',
      startTime: task.startTime,
      endTime: task.endTime || null,
      exitCode: task.exitCode,
      logFile: task.logFile
    };
  }

  killTask({ taskId }) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const alive = this.isProcessAlive(task.pid);
    if (!alive) {
      task.status = 'EXITED';
      this.saveRegistry();
      return { taskId, killed: false, message: 'Process was already terminated.' };
    }

    try {
      // Kill entire process group if possible
      process.kill(-task.pid, 'SIGTERM');
    } catch {
      try {
        process.kill(task.pid, 'SIGTERM');
      } catch {}
    }

    task.status = 'KILLED';
    task.endTime = new Date().toISOString();
    this.saveRegistry();

    return {
      taskId,
      pid: task.pid,
      killed: true,
      status: 'KILLED',
      message: `Process ${task.pid} (${taskId}) terminated.`
    };
  }
}

let defaultManagerInstance = null;
export function getProcessManager(cwd = process.cwd()) {
  if (!defaultManagerInstance || defaultManagerInstance.cwd !== cwd) {
    defaultManagerInstance = new ProcessManager(cwd);
  }
  return defaultManagerInstance;
}
