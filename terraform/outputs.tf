output "ec2_public_ip" {
  description = "IP pública de la instancia EC2 (Úsala para el secreto AWS_EC2_HOST en GitHub)"
  value       = aws_instance.app_server.public_ip
}

output "ec2_ssh_user" {
  description = "Usuario SSH para conectarse (Úsalo para el secreto AWS_EC2_USER en GitHub)"
  value       = "ubuntu"
}

output "ssh_private_key_path" {
  description = "Ruta local donde se guardó la llave privada generada"
  value       = local_file.ssh_key.filename
}

output "ssh_connection_command" {
  description = "Comando rápido para conectarte por SSH desde la carpeta terraform"
  value       = "ssh -i innovait-key.pem ubuntu@${aws_instance.app_server.public_ip}"
}

output "frontend_url" {
  description = "URL para acceder al Frontend"
  value       = "http://${aws_instance.app_server.public_ip}:3000"
}

output "backend_docs_url" {
  description = "URL para acceder a la documentación interactiva Swagger del Backend"
  value       = "http://${aws_instance.app_server.public_ip}:8000/docs"
}
