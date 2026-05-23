-- 保存 schema， 同步数据库结构
/*
curl http://localhost:3001/test
curl -X POST "http://localhost:3001/api/auth/login" -H "Content-Type: application/json" -d '{"email":"e1234567@u.nus.edu","password":"123456"}'
curl http://localhost:3001/api/bids
curl -X POST "http://localhost:3001/api/admin/run-allocation"
*/

--以下为在mysql里创建的table及其中数据
CREATE DATABASE IF NOT EXISTS jukebox;
USE jukebox;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255),
    email VARCHAR(255),
    password VARCHAR(255),
    role ENUM('admin', 'band', 'individual')
    );

CREATE TABLE IF NOT EXISTS bands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    leader_user_id INT,
    band_type ENUM('standard', 'cbtr', 'low_priority')
    DEFAULT 'standard',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    band_id INT,
    slot_date DATE,
    slot_time TIME,
    preference_rank INT,
    bid_value INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);