variable "aws_region" {
  description = "Región de AWS donde se desplegará la infraestructura"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Tipo de instancia EC2 elegible para Capa Gratuita (t3.micro es el estándar actual en cuentas de AWS)"
  type        = string
  default     = "t3.micro"
}

variable "project_name" {
  description = "Nombre del proyecto para etiquetar los recursos"
  type        = string
  default     = "innovait-sales"
}

variable "environment" {
  description = "Ambiente de despliegue"
  type        = string
  default     = "production"
}

variable "allowed_ssh_cidr" {
  description = "Rango CIDR con permiso para acceder vía SSH (por defecto abierto a 0.0.0.0/0)"
  type        = string
  default     = "0.0.0.0/0"
}
