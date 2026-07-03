-- 保存 schema， 同步数据库结构
--以下为在mysql里创建的table及其中数据
-- slot_time stores the starting time of a valid 2-hour booking block.
-- Valid values: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00.
CREATE DATABASE IF NOT EXISTS jukebox;
USE jukebox;

-- MS2 new user table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'band', 'individual') DEFAULT 'individual',
    status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
    is_mr_certified BOOLEAN DEFAULT FALSE,
    band_id INT NULL
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
/* MS1 bookings table, now the not commented one is the actual code for bookings
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    band_id INT NOT NULL,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    allocation_score INT,
    status ENUM('pending', 'confirmed', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
*/

CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    band_id INT NULL,
    user_id INT NULL,
    booking_type ENUM('band', 'individual') DEFAULT 'band',
    slot_category ENUM('primary', 'extra') NULL,
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    allocation_score INT,
    status ENUM('pending', 'confirmed', 'rejected', 'cancelled', 'late_cancelled', 'displaced') DEFAULT 'pending',
    reject_reason VARCHAR(255),
    cancel_reason VARCHAR(255),
    cancelled_at TIMESTAMP NULL,
    is_late_cancellation BOOLEAN DEFAULT FALSE,
    calendar_event_id VARCHAR(255),
    calendar_sync_status ENUM('not_synced', 'synced', 'deleted', 'failed', 'skipped') DEFAULT 'not_synced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );


/*
 target week_monday == the bidding round for this weelk
 status = open / closed
 */
CREATE TABLE IF NOT EXISTS bidding_windows (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_week_monday DATE NOT NULL UNIQUE,
    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    opened_at TIMESTAMP NULL,
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS band_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    band_id INT NOT NULL,
    user_id INT NOT NULL,
    member_role ENUM('leader', 'member') DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_band_user (band_id, user_id)
    );

-- reset password feature need to use
CREATE TABLE IF NOT EXISTS password_reset_otps (
    email VARCHAR(255) PRIMARY KEY,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );