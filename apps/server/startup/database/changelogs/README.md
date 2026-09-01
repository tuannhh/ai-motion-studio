# Changelogs cơ sở dữ liệu

Mỗi thay đổi cấu trúc sau baseline (`../schema.sql`) là 1 file SQL idempotent tại đây,
đặt tên `NNN-mo-ta-ngan.sql` (001, 002, ...). Áp thủ công theo thứ tự:

```
docker compose exec -T mysql mysql -h127.0.0.1 -uams -pams_dev_password ams < apps/server/startup/database/changelogs/001-....sql
```

App KHÔNG tự chạy migration — chỉ `verifyTables()` lúc khởi động (theo misa-backend-standard 05).
