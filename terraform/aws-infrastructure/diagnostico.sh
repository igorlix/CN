#!/bin/bash
# Script de diagnóstico para problemas de acesso ao sistema UPAE
# Execute este script na sua máquina local (não no EC2)

echo "🔍 DIAGNÓSTICO DE ACESSO - UPAE"
echo "================================"
echo ""

# Verificar se terraform está inicializado
if [ ! -d ".terraform" ]; then
    echo "❌ Terraform não inicializado neste diretório"
    echo "   Execute: terraform init"
    exit 1
fi

# Obter URL do Load Balancer
echo "1️⃣ Obtendo URL do Load Balancer..."
ALB_DNS=$(terraform output -raw load_balancer_url 2>/dev/null)

if [ -z "$ALB_DNS" ]; then
    echo "❌ Não foi possível obter a URL do Load Balancer"
    echo "   Execute: terraform output"
    exit 1
fi

echo "   Load Balancer URL: $ALB_DNS"
echo ""

# Testar conectividade com o Load Balancer
echo "2️⃣ Testando conectividade com Load Balancer..."
if curl -s --connect-timeout 5 "$ALB_DNS/health" > /dev/null; then
    echo "   ✅ Load Balancer está acessível"
else
    echo "   ❌ Load Balancer não está acessível"
    echo "   Possíveis causas:"
    echo "   - Security Group do ALB não permite tráfego HTTP"
    echo "   - ALB ainda está sendo provisionado (aguarde 2-3 minutos)"
fi
echo ""

# Verificar instâncias no Target Group
echo "3️⃣ Verificando instâncias no Target Group..."
TG_ARN=$(aws elbv2 describe-target-groups --names "upae-agendamento-tg" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null)

if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
    echo "   Target Group ARN: $TG_ARN"

    # Verificar saúde dos targets
    echo ""
    echo "   Status das instâncias:"
    aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' --output table
else
    echo "   ❌ Target Group não encontrado"
fi
echo ""

# Verificar Security Groups
echo "4️⃣ Verificando Security Groups..."

# ALB Security Group
ALB_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=upae-agendamento-alb-sg" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)
if [ -n "$ALB_SG" ] && [ "$ALB_SG" != "None" ]; then
    echo "   ALB Security Group: $ALB_SG"
    echo "   Regras de entrada (HTTP):"
    aws ec2 describe-security-groups --group-ids "$ALB_SG" --query 'SecurityGroups[0].IpPermissions[?FromPort==`80`]' --output table
else
    echo "   ❌ Security Group do ALB não encontrado"
fi
echo ""

# EC2 Security Group
EC2_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=upae-agendamento-web-server-sg" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)
if [ -n "$EC2_SG" ] && [ "$EC2_SG" != "None" ]; then
    echo "   EC2 Security Group: $EC2_SG"
    echo "   Regras de entrada (HTTP):"
    aws ec2 describe-security-groups --group-ids "$EC2_SG" --query 'SecurityGroups[0].IpPermissions[?FromPort==`80`]' --output table
else
    echo "   ❌ Security Group do EC2 não encontrado"
fi
echo ""

# Verificar instâncias EC2
echo "5️⃣ Verificando instâncias EC2..."
aws ec2 describe-instances --filters "Name=tag:Name,Values=upae-agendamento-asg-instance" "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PrivateIpAddress,PublicIpAddress]' --output table
echo ""

# Teste de acesso à página principal
echo "6️⃣ Testando acesso à página principal..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$ALB_DNS")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Sistema acessível! Código HTTP: $HTTP_CODE"
    echo "   URL: $ALB_DNS"
elif [ "$HTTP_CODE" = "503" ]; then
    echo "   ⚠️  Erro 503 - Service Unavailable"
    echo "   Causas possíveis:"
    echo "   - Instâncias EC2 ainda estão inicializando"
    echo "   - Nginx não está rodando nas instâncias"
    echo "   - Health check falhando"
    echo "   Aguarde 2-5 minutos e tente novamente"
else
    echo "   ❌ Erro de acesso. Código HTTP: $HTTP_CODE"
fi
echo ""

# Comandos úteis para debug
echo "7️⃣ Comandos úteis para debug:"
echo ""
echo "   # Ver outputs do Terraform:"
echo "   terraform output"
echo ""
echo "   # Conectar via Session Manager (substitua INSTANCE_ID):"
echo "   aws ssm start-session --target INSTANCE_ID"
echo ""
echo "   # Verificar logs do CloudWatch:"
echo "   aws logs tail /aws/ec2/upae/nginx/error --follow"
echo ""
echo "   # Forçar recreação das instâncias:"
echo "   terraform taint aws_launch_template.web_server"
echo "   terraform apply"
echo ""

echo "================================"
echo "📋 RESUMO"
echo "================================"
echo "URL do sistema: $ALB_DNS"
echo ""
echo "Se o sistema não estiver acessível:"
echo "1. Aguarde 3-5 minutos após o 'terraform apply'"
echo "2. Verifique se as instâncias estão 'healthy' no Target Group"
echo "3. Conecte via Session Manager e verifique os logs:"
echo "   sudo journalctl -u nginx -n 50"
echo "   sudo journalctl -u upae-api -n 50"
echo "================================"
