# Variables para configuração da infraestrutura AWS

variable "aws_region" {
  description = "Região AWS onde os recursos serão criados"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Ambiente (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Nome do projeto (usado para nomear recursos)"
  type        = string
  default     = "upae-agendamento"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block para a VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# EC2 Configuration
variable "instance_type" {
  description = "Tipo de instância EC2"
  type        = string
  default     = "t3.micro" # Free tier eligible, mude para t3.small ou maior se necessário
}

variable "key_pair_name" {
  description = "Nome do key pair para SSH (opcional, use Session Manager)"
  type        = string
  default     = null
}

variable "ssh_allowed_cidr" {
  description = "CIDR blocks permitidos para SSH (use seu IP público)"
  type        = list(string)
  default     = ["0.0.0.0/0"] # ATENÇÃO: Mude isso para seu IP específico em produção!
}

# Auto Scaling Configuration
variable "asg_min_size" {
  description = "Número mínimo de instâncias no Auto Scaling Group"
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Número máximo de instâncias no Auto Scaling Group"
  type        = number
  default     = 4
}

variable "asg_desired_capacity" {
  description = "Capacidade desejada do Auto Scaling Group"
  type        = number
  default     = 2
}

# Load Balancer Configuration
variable "enable_deletion_protection" {
  description = "Habilitar proteção contra exclusão do Load Balancer"
  type        = bool
  default     = false # Mude para true em produção
}

# SSL Certificate (para HTTPS)
variable "ssl_certificate_arn" {
  description = "ARN do certificado SSL no ACM (opcional)"
  type        = string
  default     = null
}

# Tags adicionais
variable "additional_tags" {
  description = "Tags adicionais para aplicar em todos os recursos"
  type        = map(string)
  default     = {}
}
