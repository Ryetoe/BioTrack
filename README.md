# BioTrack

## Description

TODO (pull from final report?)

## Requirements

- Python 3.10+
- Node.js 18+
- MySQL 8.0+

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/swu955/biotrack.git
cd biotrack
```

### 2. Backend

Create and activate a virtual environment:

**macOS/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows:**
```bash
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

Create a `.env` file inside the project root directory:

```
DATABASE_URL=mysql+pymysql://biotrack_user:<password>@localhost:3306/biotrack
```

### 3. MySQL

Make sure MySQL is running, then create the database and user:

**macOS (Homebrew):**
```bash
brew install mysql
brew services start mysql
mysql_secure_installation  # optional but recommended
mysql -u root -p
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql -u root
```

**Windows:**

Download and run the [MySQL Installer](https://dev.mysql.com/downloads/installer/). During setup, choose "Developer Default" and set a root password. Then open MySQL Workbench or the MySQL Command Line Client.

Then run the SQL:

```sql
CREATE DATABASE biotrack;
CREATE USER 'biotrack_user'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON biotrack.* TO 'biotrack_user'@'localhost';
FLUSH PRIVILEGES;
```

## Running the app

```bash
make run
```

On first startup, the backend will automatically create all tables and seed animal, question, and badge data from the JSON files in `backend/data/`.

**Note for Windows users:** `make` may not be available by default. You can install it via [Chocolatey](https://chocolatey.org/) (`choco install make`), or run the backend and frontend commands manually — check the `Makefile` for the exact commands.

### Running the tests (TBD)

```bash
pytest
```

## Credits

TODO (reference group 33)