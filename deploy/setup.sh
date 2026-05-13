#!/bin/bash
set -e

echo "=== LeadGen CRM Server Setup (Amazon Linux 2023) ==="

# Update system
sudo dnf update -y

# Install Python & dev tools
sudo dnf install -y python3 python3-pip python3-devel gcc

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install PostgreSQL
sudo dnf install -y postgresql16-server postgresql16
sudo postgresql-setup --initdb 2>/dev/null || echo "DB cluster already initialized"
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configure PostgreSQL auth (md5 for local connections)
sudo sed -i 's/ident$/md5/g' /var/lib/pgsql/data/pg_hba.conf
sudo sed -i 's/peer$/md5/g' /var/lib/pgsql/data/pg_hba.conf
sudo systemctl restart postgresql

# Create database and user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE leadgen_crm;" 2>/dev/null || echo "Database already exists"

# Install Nginx
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Setup project
cd /home/ec2-user/leadgen-crm

# Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Create .env
if [ ! -f .env ]; then
    echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leadgen_crm" > .env
fi

# Setup Nginx
sudo cp deploy/nginx.conf /etc/nginx/conf.d/leadgen-crm.conf
sudo rm -f /etc/nginx/conf.d/default.conf
sudo nginx -t && sudo systemctl restart nginx

# Setup systemd service
sudo cp deploy/leadgen-crm.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable leadgen-crm
sudo systemctl start leadgen-crm

echo "=== Deployment Complete ==="
echo "Frontend: http://35.154.251.140"
echo "Backend API: http://35.154.251.140/api"
