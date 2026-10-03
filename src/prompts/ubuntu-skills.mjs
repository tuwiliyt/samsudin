/**
 * Ubuntu Linux Terminal Master Skills & Guidelines for Samsudin.
 * Provides deep operational guidance for package installation, process monitoring,
 * Docker/Kubernetes management, networking, and daemon workflows.
 */
export const UBUNTU_TERMINAL_SKILLS = `
## Ubuntu Linux Terminal Operations & Superpowers:

You have full authority to execute shell commands directly in the Ubuntu environment. Always follow these best practices:

### 1. Package & Application Installation
- **APT Package Manager**: Always use non-interactive flags when installing system packages:
  \`apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends <package>\`
- **Language Runtimes & Package Managers**:
  - Python: \`pip install <package>\` or \`python3 -m pip install <package>\`
  - Node.js: \`npm install <package>\` or \`npm install -g <package>\`
  - Snap / Deb: \`dpkg -i <file.deb>\` or \`snap install <package>\`
- **Check installed binaries**: Use \`which <binary>\` or \`command -v <binary>\` to check availability before running.

### 2. Process Monitoring & Port Inspection
- **Listening Ports & Sockets**: Inspect active ports using:
  \`ss -tulpn\` or \`lsof -i :<port>\` or \`netstat -tlpn\`
- **Process Inspection**: Check running processes with:
  \`ps aux | grep <name>\` or \`pgrep -fl <name>\`
- **Resource Utilization**: Check system limits with:
  \`free -h\` (RAM), \`df -h\` (Disk), \`uptime\`, and \`nproc\` (CPU cores).

### 3. Background Services & Long-Running Daemons
- When launching continuous services (e.g. web servers, APIs, watchers, tunnels, long scripts):
  - Use \`bash\` tool with parameter \`"isBackground": true\`.
  - This immediately returns a \`taskId\` and writes stdout/stderr to a log file.
  - To monitor ongoing progress, invoke \`process_manager\` with \`"action": "logs", "taskId": "<id>"\`.
  - To check health, invoke \`process_manager\` with \`"action": "status", "taskId": "<id>"\`.
  - To stop a service, invoke \`process_manager\` with \`"action": "kill", "taskId": "<id>"\`.
- Systemd Services: Check status via \`systemctl status <service> --no-pager\` or \`journalctl -u <service> -n 50 --no-pager\`.

### 4. Docker & Container Management
- Check Docker daemon status: \`docker info\` or \`docker version\`
- Inspect containers: \`docker ps -a\`
- Build image: \`docker build -t <tag> .\`
- Run container detached: \`docker run -d --name <name> -p <host_port>:<container_port> <image>\`
- Read container logs: \`docker logs --tail 50 <container_id>\`
- Docker Compose: \`docker compose up -d\` and \`docker compose logs\`

### 5. Kubernetes (kubectl)
- Check cluster connectivity: \`kubectl cluster-info\` and \`kubectl get nodes\`
- Inspect workloads: \`kubectl get pods -A\` and \`kubectl get svc -A\`
- Debug pod failures: \`kubectl describe pod <name>\` and \`kubectl logs <name> --tail 50\`

### 6. Networking & HTTP Diagnostics
- Probe HTTP endpoints: \`curl -sSL -I <url>\` or \`curl -sSL <url>\`
- Inspect network interfaces: \`ip addr show\` and \`ip route\`
- Test DNS: \`dig +short <host>\` or \`nslookup <host>\`
- Verify open firewall ports: \`ufw status\`
`;
