#!/bin/bash
# User Data Script para configurar servidor web UPAE + Backend Python API
# Este script é executado automaticamente quando a instância EC2 inicia

set -e

# Atualizar sistema
dnf update -y

# Instalar pacotes necessários
dnf install -y \
    nginx \
    git \
    python3 \
    python3-pip

# Configurar timezone
timedatectl set-timezone America/Recife

# ==========================================
# CLONAR REPOSITÓRIO DA APLICAÇÃO
# ==========================================
cd /tmp
git clone https://github.com/igorlix/CN.git upae-repo
cd upae-repo

# ==========================================
# FRONTEND - Configurar aplicação web
# ==========================================
mkdir -p /var/www/upae

# Copiar arquivos do frontend
cp -r index.html resultado.html login.html politica-privacidade.html diagnostico-maps.html /var/www/upae/ 2>/dev/null || true
cp -r src/ /var/www/upae/ 2>/dev/null || true
cp -r public/ /var/www/upae/ 2>/dev/null || true

# Se não houver arquivos, criar placeholder
if [ ! -f /var/www/upae/index.html ]; then
    cat > /var/www/upae/index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPAE - Sistema de Agendamento</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; }
        .status {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(46, 213, 115, 0.3);
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏥 UPAE - Sistema de Agendamento</h1>
        <p>Sistema Online de Otimização de Alocação de Pacientes</p>
        <div class="status">
            ✅ Frontend configurado com sucesso!<br>
            ✅ Backend API rodando em /api<br>
            <small>Instância: <span id="instance-id">Carregando...</span></small>
        </div>
        <p style="margin-top: 2rem; font-size: 0.9rem; opacity: 0.8;">
            Secretaria de Saúde do Estado de Pernambuco
        </p>
    </div>
    <script>
        fetch('http://169.254.169.254/latest/meta-data/instance-id')
            .then(r => r.text())
            .then(id => document.getElementById('instance-id').textContent = id)
            .catch(() => document.getElementById('instance-id').textContent = 'N/A');
    </script>
</body>
</html>
EOF
fi

# Configurar permissões do frontend
chown -R nginx:nginx /var/www/upae
chmod -R 755 /var/www/upae

# ==========================================
# BACKEND - Configurar API Python
# ==========================================

# Criar diretório para o backend
mkdir -p /opt/upae-api
cd /tmp/upae-repo

# Copiar arquivos do backend
cp -r algoritmo/* /opt/upae-api/ 2>/dev/null || true

# Se não houver requirements.txt, criar um básico
if [ ! -f /opt/upae-api/requirements.txt ]; then
    cat > /opt/upae-api/requirements.txt << 'EOF'
Flask==3.0.0
flask-cors==4.0.0
numpy==1.24.3
EOF
fi

# Instalar dependências Python
cd /opt/upae-api
pip3 install --upgrade pip
pip3 install -r requirements.txt

# Criar usuário para rodar a API (segurança)
useradd -r -s /bin/false upae-api || true

# Ajustar permissões
chown -R upae-api:upae-api /opt/upae-api
chmod -R 755 /opt/upae-api

# ==========================================
# SYSTEMD SERVICE - API Python
# ==========================================

cat > /etc/systemd/system/upae-api.service << 'EOF'
[Unit]
Description=UPAE Genetic Algorithm Optimization API
After=network.target

[Service]
Type=simple
User=upae-api
Group=upae-api
WorkingDirectory=/opt/upae-api
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONUNBUFFERED=1"
ExecStart=/usr/bin/python3 /opt/upae-api/api_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=upae-api

# Limites de recursos
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd e iniciar API
systemctl daemon-reload
systemctl enable upae-api
systemctl start upae-api

# Aguardar API inicializar
sleep 5

# Verificar se API está rodando
if systemctl is-active --quiet upae-api; then
    echo "✅ API Python iniciada com sucesso"
else
    echo "⚠️ Erro ao iniciar API Python"
    journalctl -u upae-api -n 50 >> /var/log/upae-setup.log
fi

# ==========================================
# NGINX - Configurar como Reverse Proxy
# ==========================================

cat > /etc/nginx/conf.d/upae.conf << 'EOF'
# Upstream para a API Python
upstream upae_api {
    server 127.0.0.1:5000 fail_timeout=10s max_fails=3;
}

server {
    listen 80;
    server_name _;

    # Logs
    access_log /var/log/nginx/upae_access.log;
    error_log /var/log/nginx/upae_error.log;

    # Compressão
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Health check endpoint (para ALB)
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Proxy para API Python (Backend)
    location /api/ {
        proxy_pass http://upae_api/api/;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts (API pode demorar com algoritmo genético)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffers
        proxy_buffering off;
        proxy_request_buffering off;

        # CORS (já está no Flask, mas reforça)
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
    }

    # Servir arquivos estáticos (Frontend)
    location / {
        root /var/www/upae;
        index index.html;
        try_files $uri $uri/ =404;

        # CORS para arquivos estáticos
        add_header 'Access-Control-Allow-Origin' '*' always;
    }

    # Cache para assets estáticos
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        root /var/www/upae;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Desabilitar configuração padrão do nginx
rm -f /etc/nginx/conf.d/default.conf

# Testar configuração do nginx
nginx -t

# Iniciar e habilitar Nginx
systemctl start nginx
systemctl enable nginx

# ==========================================
# CLOUDWATCH AGENT
# ==========================================

cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << 'EOF'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/nginx/upae_access.log",
            "log_group_name": "/aws/ec2/upae/nginx/access",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/nginx/upae_error.log",
            "log_group_name": "/aws/ec2/upae/nginx/error",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "UPAE/WebServer",
    "metrics_collected": {
      "mem": {
        "measurement": [
          {
            "name": "mem_used_percent",
            "rename": "MemoryUtilization"
          }
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          {
            "name": "used_percent",
            "rename": "DiskUtilization"
          }
        ],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      }
    }
  }
}
EOF

# Iniciar CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json

# ==========================================
# SCRIPTS DE MANUTENÇÃO
# ==========================================

# Script de atualização da aplicação
cat > /usr/local/bin/update-upae.sh << 'EOF'
#!/bin/bash
# Script para atualizar a aplicação UPAE
# Execute: sudo /usr/local/bin/update-upae.sh

echo "🔄 Atualizando aplicação UPAE..."

# Backup
tar -czf /tmp/upae-backup-$(date +%Y%m%d-%H%M%S).tar.gz /var/www/upae /opt/upae-api

# Atualizar frontend
cd /tmp
rm -rf upae-repo
git clone https://github.com/igorlix/CN.git upae-repo
cd upae-repo

# Frontend
cp -r index.html resultado.html login.html politica-privacidade.html diagnostico-maps.html /var/www/upae/ 2>/dev/null || true
cp -r src/ /var/www/upae/ 2>/dev/null || true
cp -r public/ /var/www/upae/ 2>/dev/null || true
chown -R nginx:nginx /var/www/upae

# Backend
cp -r algoritmo/* /opt/upae-api/ 2>/dev/null || true
chown -R upae-api:upae-api /opt/upae-api

# Reinstalar dependências Python (caso tenham mudado)
cd /opt/upae-api
pip3 install -r requirements.txt

# Reiniciar serviços
systemctl restart upae-api
systemctl reload nginx

echo "✅ Aplicação atualizada com sucesso!"
echo "📊 Status dos serviços:"
systemctl status upae-api --no-pager -l
systemctl status nginx --no-pager -l
EOF

chmod +x /usr/local/bin/update-upae.sh

# Script de verificação de saúde
cat > /usr/local/bin/health-check-upae.sh << 'EOF'
#!/bin/bash
# Script de health check completo

echo "=== UPAE Health Check ==="
echo ""

# 1. Nginx
echo "1. Nginx:"
systemctl is-active nginx && echo "   ✅ Ativo" || echo "   ❌ Inativo"

# 2. API Python
echo "2. API Python:"
systemctl is-active upae-api && echo "   ✅ Ativo" || echo "   ❌ Inativo"

# 3. Teste de endpoint da API
echo "3. Endpoint /api/health:"
response=$(curl -s http://localhost:5000/health)
if echo "$response" | grep -q "healthy"; then
    echo "   ✅ Respondendo"
else
    echo "   ❌ Não respondendo"
fi

# 4. Frontend
echo "4. Frontend:"
if [ -f /var/www/upae/index.html ]; then
    echo "   ✅ Arquivos presentes"
else
    echo "   ❌ Arquivos ausentes"
fi

# 5. Logs recentes de erro
echo "5. Erros recentes (últimas 10 linhas):"
tail -n 10 /var/log/nginx/upae_error.log 2>/dev/null || echo "   Nenhum erro"

echo ""
echo "==========================="
EOF

chmod +x /usr/local/bin/health-check-upae.sh

# Configurar firewall (firewalld)
systemctl start firewalld
systemctl enable firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Criar arquivo de informações do sistema
cat > /var/www/upae/server-info.txt << EOF
Server configured at: $(date)
Hostname: $(hostname)
Instance ID: $(ec2-metadata --instance-id | cut -d " " -f 2)
Project: ${project_name}
Frontend: /var/www/upae
Backend: /opt/upae-api
API Port: 5000 (interno)
EOF

# ==========================================
# VERIFICAÇÃO FINAL
# ==========================================

echo "========================================" >> /var/log/upae-setup.log
echo "Setup completed at $(date)" >> /var/log/upae-setup.log
echo "========================================" >> /var/log/upae-setup.log

# Verificar status dos serviços
echo "Service Status:" >> /var/log/upae-setup.log
systemctl status nginx --no-pager >> /var/log/upae-setup.log 2>&1
systemctl status upae-api --no-pager >> /var/log/upae-setup.log 2>&1

# Teste rápido da API
sleep 3
curl -s http://localhost:5000/health >> /var/log/upae-setup.log 2>&1

# Sinalizar conclusão
touch /var/www/upae/.setup-complete
touch /opt/upae-api/.setup-complete

echo "✅ Setup completo!" >> /var/log/upae-setup.log
