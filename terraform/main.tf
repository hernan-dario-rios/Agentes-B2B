provider "aws" {
  region = var.aws_region
}

# Obtener la VPC por defecto de la cuenta en la región indicada
data "aws_vpc" "default" {
  default = true
}

# Obtener la última AMI oficial de Ubuntu 24.04 LTS
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# 1. Generar automáticamente el par de llaves SSH privadas/públicas
resource "tls_private_key" "rsa_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# 2. Registrar la llave pública en AWS EC2
resource "aws_key_pair" "generated_key" {
  key_name   = "${var.project_name}-key"
  public_key = tls_private_key.rsa_key.public_key_openssh
}

# 3. Guardar la llave privada localmente para conectarte o copiarla a GitHub Secrets
resource "local_file" "ssh_key" {
  content         = tls_private_key.rsa_key.private_key_pem
  filename        = "${path.module}/innovait-key.pem"
  file_permission = "0600"
}

# 4. Grupo de Seguridad (Firewall)
resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-sg"
  description = "Reglas de seguridad para acceso SSH, Frontend y Backend de Innovait"
  vpc_id      = data.aws_vpc.default.id

  # Acceso SSH
  ingress {
    description = "SSH para despliegue y administracion"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # Frontend Next.js
  ingress {
    description = "Frontend Next.js"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Backend FastAPI
  ingress {
    description = "API FastAPI y Documentacion Swagger"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP Estándar
  ingress {
    description = "HTTP puerto 80"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Salida libre a Internet para descargar dependencias e imágenes Docker
  egress {
    description = "Trafico de salida"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-sg"
    Environment = var.environment
  }
}

# 5. Instancia EC2 Free Tier
resource "aws_instance" "app_server" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = aws_key_pair.generated_key.key_name
  vpc_security_group_ids      = [aws_security_group.app_sg.id]
  associate_public_ip_address = true

  root_block_device {
    volume_size           = 25 # GB (dentro de los 30 GB gratuitos de EBS)
    volume_type           = "gp3"
    delete_on_termination = true
    tags = {
      Name = "${var.project_name}-root-disk"
    }
  }

  # Script de inicialización automático en el primer arranque
  user_data = <<-EOF
    #!/bin/bash
    set -e

    # 1. Configurar 2GB de memoria Swap para garantizar compilación en t3.micro
    if [ ! -f /swapfile ]; then
      fallocate -l 2G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    # 2. Instalar Docker, Docker Compose y Git
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg git docker.io docker-compose-plugin

    # 3. Arrancar Docker y agregar usuario ubuntu
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ubuntu

    # 4. Crear carpeta base para el proyecto
    mkdir -p /home/ubuntu/innovait-app
    chown -R ubuntu:ubuntu /home/ubuntu/innovait-app
  EOF

  tags = {
    Name        = "${var.project_name}-server"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
