# 🔧 Guia de Troubleshooting - Problema de Acesso

## Situação Atual
Você criou a infraestrutura com Terraform e colocou o código no EC2, mas não consegue acessar o link.

## ✅ Verificações Rápidas

### 1. Obter a URL do Load Balancer

```bash
cd c:\Users\jaque\Documents\Igor\CN\terraform\aws-infrastructure
terraform output load_balancer_url
```

Você deve ver algo como:
```
http://upae-agendamento-alb-1234567890.us-east-1.elb.amazonaws.com
```

### 2. Testar o acesso

Abra essa URL no navegador ou teste via curl:

```bash
curl http://upae-agendamento-alb-1234567890.us-east-1.elb.amazonaws.com
```

## 🔍 Diagnósticos por Tipo de Erro

### Erro 1: "Site can't be reached" / Timeout

**Causa**: Security Group do ALB não está permitindo acesso público.

**Solução**:

```bash
# 1. Verificar Security Group do ALB
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=upae-agendamento-alb-sg" \
  --query 'SecurityGroups[0].IpPermissions'

# 2. Você deve ver uma regra permitindo porta 80 de 0.0.0.0/0
# Se não houver, adicione manualmente:
ALB_SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=upae-agendamento-alb-sg" --query 'SecurityGroups[0].GroupId' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0
```

### Erro 2: "503 Service Unavailable"

**Causa**: As instâncias EC2 não estão saudáveis no Target Group.

**Diagnóstico**:

```bash
# Verificar saúde das instâncias no Target Group
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names upae-agendamento-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)
```

**Possíveis estados e soluções**:

#### Estado: `initial` ou `unhealthy`
As instâncias ainda estão inicializando ou o Nginx não está respondendo.

**Solução 1: Aguardar**
```bash
# Aguarde 3-5 minutos e teste novamente
# O user-data pode levar tempo para executar
```

**Solução 2: Verificar logs da instância**
```bash
# 1. Listar instâncias
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=upae-agendamento-asg-instance" \
            "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' \
  --output table

# 2. Conectar via Session Manager (substitua INSTANCE_ID)
aws ssm start-session --target i-0123456789abcdef0

# 3. Dentro da instância, verificar status dos serviços:
sudo systemctl status nginx
sudo systemctl status upae-api
sudo journalctl -u nginx -n 50
sudo journalctl -u upae-api -n 50

# 4. Verificar se o nginx está escutando na porta 80
sudo netstat -tlnp | grep :80

# 5. Verificar se a aplicação está no lugar correto
ls -la /var/www/upae/
ls -la /opt/upae-api/

# 6. Testar acesso local
curl http://localhost
curl http://localhost/health
```

**Solução 3: Verificar user-data executou corretamente**
```bash
# Conectar via Session Manager e verificar:
cat /var/log/upae-setup.log
tail -100 /var/log/cloud-init-output.log
```

#### Estado: `draining`
Instâncias estão sendo removidas.

**Solução**: Aguardar nova instância ser criada automaticamente.

### Erro 3: "502 Bad Gateway"

**Causa**: Nginx está rodando mas não consegue se comunicar com o backend.

**Solução**:

```bash
# Conectar na instância e verificar:
sudo systemctl status upae-api
sudo journalctl -u upae-api -n 50

# Se a API não estiver rodando, iniciar manualmente:
sudo systemctl start upae-api

# Verificar se a API responde:
curl http://localhost:5000/health
```

### Erro 4: Network ACLs bloqueando tráfego

**Verificação**:

```bash
# Verificar Network ACLs da VPC
aws ec2 describe-network-acls \
  --filters "Name=vpc-id,Values=$(terraform output -raw vpc_id)" \
  --query 'NetworkAcls[*].Entries' \
  --output table
```

As Network ACLs padrão já permitem todo o tráfego, então geralmente não é o problema.

## 🚀 Solução Rápida: Recriar Infraestrutura

Se nada funcionar, recrie as instâncias EC2:

```bash
# 1. Forçar recreação das instâncias
terraform taint aws_launch_template.web_server
terraform apply

# 2. Aguardar 5 minutos
# 3. Testar novamente
```

## 🔐 Verificar se o Problema é Realmente de Security Group

Execute este teste:

```bash
# 1. Obter IP público de uma instância EC2
INSTANCE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=upae-agendamento-asg-instance" \
            "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "IP da instância: $INSTANCE_IP"

# 2. Tentar acessar diretamente (NÃO vai funcionar porque está em subnet privada)
# Mas se a instância tiver IP público, podemos testar:
curl http://$INSTANCE_IP

# 3. Se não funcionar, o problema é de Security Group do EC2
# Adicionar regra temporária para permitir HTTP de qualquer lugar:
EC2_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=upae-agendamento-web-server-sg" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# 4. Testar novamente via Load Balancer
```

⚠️ **IMPORTANTE**: As instâncias estão em **subnets privadas** e não têm IP público por padrão, então o acesso direto não funcionará. Todo o tráfego deve passar pelo Load Balancer.

## 📊 Checklist Completo

Marque cada item verificado:

- [ ] Terraform apply executou sem erros
- [ ] Load Balancer foi criado (via console AWS ou `terraform output`)
- [ ] Security Group do ALB permite porta 80 de `0.0.0.0/0`
- [ ] Security Group do EC2 permite porta 80 do Security Group do ALB
- [ ] Instâncias EC2 estão no estado "running"
- [ ] Instâncias aparecem como "healthy" no Target Group
- [ ] Aguardou pelo menos 5 minutos após o terraform apply
- [ ] Nginx está rodando nas instâncias (`systemctl status nginx`)
- [ ] API Python está rodando (`systemctl status upae-api`)
- [ ] Arquivo index.html existe em `/var/www/upae/`
- [ ] Health check `/health` responde na instância (`curl localhost/health`)

## 🛠️ Comando de Debug Completo

Execute este comando para verificar tudo de uma vez:

```bash
# Salve como check-all.sh e execute:
#!/bin/bash

echo "=== VERIFICAÇÃO COMPLETA DA INFRAESTRUTURA ==="
echo ""

# 1. Terraform
echo "1. Terraform outputs:"
terraform output
echo ""

# 2. Target Group Health
echo "2. Target Group Health:"
TG_ARN=$(aws elbv2 describe-target-groups --names upae-agendamento-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --target-group-arn $TG_ARN --output table
echo ""

# 3. Security Groups
echo "3. ALB Security Group (deve permitir 0.0.0.0/0 na porta 80):"
aws ec2 describe-security-groups --filters "Name=group-name,Values=upae-agendamento-alb-sg" --query 'SecurityGroups[0].IpPermissions[?FromPort==`80`]' --output table
echo ""

echo "4. EC2 Security Group (deve permitir ALB na porta 80):"
aws ec2 describe-security-groups --filters "Name=group-name,Values=upae-agendamento-web-server-sg" --query 'SecurityGroups[0].IpPermissions[?FromPort==`80`]' --output table
echo ""

# 5. Instâncias
echo "5. Instâncias EC2:"
aws ec2 describe-instances --filters "Name=tag:Name,Values=upae-agendamento-asg-instance" "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PrivateIpAddress]' --output table
echo ""

# 6. Teste HTTP
echo "6. Teste de acesso:"
ALB_URL=$(terraform output -raw load_balancer_url)
echo "URL: $ALB_URL"
curl -I $ALB_URL
echo ""

echo "=== FIM DA VERIFICAÇÃO ==="
```

## 💡 Solução Mais Provável

Com base na sua descrição, o problema mais provável é:

### **As instâncias estão inicializando ou o user-data falhou**

**Solução Definitiva**:

1. **Verificar se instâncias estão "healthy"**:
   ```bash
   aws elbv2 describe-target-health --target-group-arn $(aws elbv2 describe-target-groups --names upae-agendamento-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
   ```

2. **Se estiverem "unhealthy", conectar via Session Manager**:
   ```bash
   # Listar instâncias
   aws ec2 describe-instances --filters "Name=tag:Name,Values=upae-agendamento-asg-instance" "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].InstanceId' --output text

   # Conectar (substitua o ID)
   aws ssm start-session --target i-XXXXXXXXX
   ```

3. **Dentro da instância, verificar o problema**:
   ```bash
   # Ver status
   sudo systemctl status nginx
   sudo systemctl status upae-api

   # Ver logs
   sudo journalctl -u nginx -n 100
   sudo tail -50 /var/log/upae-setup.log

   # Testar localmente
   curl http://localhost
   curl http://localhost/health
   ```

4. **Corrigir o problema**:
   ```bash
   # Se nginx não estiver rodando:
   sudo systemctl start nginx
   sudo systemctl enable nginx

   # Se arquivos não estiverem no lugar:
   ls -la /var/www/upae/

   # Se precisar executar o script de setup novamente:
   sudo bash /var/lib/cloud/instance/user-data.txt
   ```

## 📞 Próximos Passos

Execute os comandos nesta ordem:

```bash
# 1. Ver URL do Load Balancer
terraform output load_balancer_url

# 2. Verificar saúde das instâncias
aws elbv2 describe-target-health --target-group-arn $(aws elbv2 describe-target-groups --names upae-agendamento-tg --query 'TargetGroups[0].TargetGroupArn' --output text)

# 3. Se unhealthy, conectar na instância e investigar
aws ec2 describe-instances --filters "Name=tag:Name,Values=upae-agendamento-asg-instance" "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].InstanceId' --output text
```

Me envie os resultados desses comandos e posso te ajudar a resolver!
