# 🛒 Forum FJB ReyCode

<div align="center">

<img src="https://img.shields.io/badge/ReyCode-Forum%20FJB-111111?style=for-the-badge&logo=github&logoColor=white">

<img src="https://img.shields.io/badge/Node.js-20%2B-111111?style=for-the-badge&logo=node.js&logoColor=white">

<img src="https://img.shields.io/badge/Express-5-111111?style=for-the-badge&logo=express&logoColor=white">

<img src="https://img.shields.io/badge/MongoDB-Database-111111?style=for-the-badge&logo=mongodb&logoColor=white">

<img src="https://img.shields.io/badge/Mongoose-8-111111?style=for-the-badge&logo=mongoose&logoColor=white">

</div>

<div align="center">

### Community • Forum • Marketplace • Reseller

**Tempat komunitas ReyCode untuk berbagi, berdiskusi, menawarkan produk, dan membangun reputasi secara terstruktur.**

</div>

---

## 📖 Tentang Project

**Forum FJB ReyCode** adalah platform forum dan marketplace komunitas yang dibuat untuk menggabungkan fitur forum, jual beli, profil pengguna, sistem reseller, interaksi sosial, rating, komentar, serta moderasi dalam satu platform.

Project ini menggunakan:

- Node.js
- Express.js
- MongoDB
- Mongoose
- HTML
- CSS
- JavaScript
- Session Authentication
- REST API

Database utama project menggunakan database MongoDB:

```text
userfjb
```

Project dirancang dengan pendekatan modular sehingga API, model database, middleware, dan halaman frontend dipisahkan berdasarkan fungsi masing-masing.

---

# ✨ Fitur Utama

## 👤 User System

Setiap pengguna mempunyai profil sendiri dengan:

- Username
- Email
- Avatar
- Bio
- Role
- Verified status
- Reseller status
- Jumlah followers
- Jumlah following
- Jumlah posting
- Status akun
- Riwayat login
- Riwayat IP keamanan

Pengguna dapat mengubah:

- Avatar
- Bio

Username dan email tidak dapat diubah melalui profile update biasa.

---

# 🔐 Authentication

Forum menggunakan sistem authentication berbasis session.

Flow authentication:

```text
REGISTER
   │
   ▼
HASH PASSWORD
   │
   ▼
MONGODB USERS
   │
   ▼
LOGIN
   │
   ▼
CREATE SESSION
   │
   ▼
HTTPONLY COOKIE
   │
   ▼
/api/auth/me
   │
   ▼
AUTHENTICATED USER
```

Cookie session:

```text
fjb_session
```

Session disimpan di MongoDB dan tidak lagi menggunakan `Map` memory sebagai penyimpanan utama.

Session mempunyai:

- Token hash
- User
- IP
- User Agent
- Created time
- Last used time
- Expiration
- Revoked time

Session mempunyai masa aktif maksimal:

```text
7 hari
```

Session yang sudah expired akan dibersihkan oleh MongoDB TTL index.

---

# 🛡️ Security

Project menggunakan beberapa lapisan keamanan.

### Password

Password user tidak disimpan dalam bentuk plaintext.

Password di-hash menggunakan:

```text
bcryptjs
```

### Session

Token session tidak disimpan langsung di database.

Token diubah menjadi SHA-256 hash sebelum disimpan.

### Cookie

Session menggunakan:

```text
HttpOnly
SameSite=Lax
```

Pada production:

```text
Secure
```

juga digunakan.

### IP Security

Sistem mencatat IP untuk kebutuhan keamanan internal.

Jenis aktivitas yang dapat dicatat:

```text
register
login
logout
```

IP tidak ditampilkan sebagai informasi publik.

---

# 👥 Role System

Forum mempunyai beberapa role:

```text
user
admin
developer
system
```

### User

Pengguna normal yang dapat:

- Membuat posting
- Membuat product listing
- Like posting
- Komentar
- Like komentar
- Follow user
- Memberikan rating
- Membuat report
- Mengajukan reseller verification

### Admin

Admin dapat melakukan moderasi dan mengakses dashboard administrasi.

### Developer

Developer mempunyai akses administrasi tingkat tinggi untuk kebutuhan pengembangan dan pengelolaan sistem.

### System

Account khusus sistem.

Contoh:

```text
Robot Security
```

---

# 🔵 Verified & Reseller System

Verified status dan reseller status merupakan dua sistem yang berbeda.

Status reseller:

```text
none
pending
approved
rejected
suspended
```

Pengguna tidak otomatis menjadi reseller setelah mendaftar.

Flow:

```text
USER
 │
 ▼
RESELLER APPLICATION
 │
 ▼
PENDING
 │
 ├── REJECTED
 │
 └── APPROVED
       │
       ▼
   VERIFIED USER
```

Jika reseller disuspend:

```text
APPROVED
   │
   ▼
SUSPENDED
   │
   └── VERIFIED BADGE DICABUT
```

Setiap perubahan status reseller dapat dicatat melalui verification history.

Verified badge bukan jaminan bahwa transaksi dengan pengguna tertentu pasti aman.

Tetap lakukan pemeriksaan sebelum melakukan transaksi.

---

# 🛍️ Forum & Marketplace

Posting mendukung dua tipe:

```text
post
product
```

### Post

Digunakan untuk:

- Diskusi
- Informasi
- Komunitas
- Sharing

### Product

Digunakan untuk:

- Jual beli
- Digital product
- Produk komunitas
- Listing reseller

Product dapat mempunyai:

```text
Title
Price
Currency
Stock
Images
Video
Category
Subcategory
```

---

# 🖼️ Media

Satu posting dapat mempunyai beberapa media.

Media mendukung:

```text
image
video
```

Maksimal konsep media dalam satu post:

```text
10 media
```

URL media disimpan di MongoDB.

File media tidak disimpan langsung sebagai binary di MongoDB.

Format media:

```json
{
  "url": "https://example.com/image.jpg",
  "type": "image"
}
```

---

# 🌐 Visibility

Posting mempunyai dua visibility:

```text
public
private
```

### Public

Dapat dilihat oleh pengguna yang mempunyai akses ke forum.

### Private

Hanya dapat dilihat oleh:

```text
Owner
Admin
Developer
```

Backend tetap melakukan enforcement sehingga private post tidak hanya bergantung pada frontend.

---

# ❤️ Like System

User dapat memberikan like pada:

```text
Post
Comment
```

Sistem menggunakan collection khusus:

```text
likes
```

Satu user tidak dapat membuat like duplikat terhadap target yang sama.

User juga diperbolehkan melakukan self-like sesuai aturan project.

---

# 💬 Comment System

Posting mendukung komentar dan reply.

Struktur:

```text
POST
 │
 ├── COMMENT
 │    ├── REPLY
 │    ├── REPLY
 │
 ├── COMMENT
 │
 └── COMMENT
```

Comment mempunyai:

- Author
- Content
- Parent
- Likes
- Status
- Created time
- Deleted time

Comment menggunakan soft delete sehingga data tidak langsung dihapus secara permanen.

---

# ⭐ Rating System

Product/post dapat menerima rating:

```text
1 ⭐
2 ⭐
3 ⭐
4 ⭐
5 ⭐
```

User juga dapat memberikan review.

Satu user hanya mempunyai satu rating aktif untuk satu post.

Rating yang dibuat oleh owner terhadap post miliknya sendiri tidak diperbolehkan.

Sistem menghitung:

```text
Rating Average
Rating Count
Distribution
```

---

# 👥 Follow System

User dapat:

```text
Follow
Unfollow
```

Sistem menyimpan:

```text
followersCount
followingCount
```

Aturan:

- Tidak dapat follow diri sendiri
- Tidak ada duplicate follow
- User suspended tidak dapat memulai follow baru
- Relasi follow dapat tetap tersimpan ketika terjadi perubahan status moderasi

---

# 🚨 Report System

Pengguna dapat melaporkan:

```text
User
Post
Comment
```

Reason yang tersedia:

```text
scam
spam
product_mismatch
rule_violation
suspicious
other
```

Report tidak langsung melakukan suspend otomatis.

Flow:

```text
USER REPORT
    │
    ▼
PENDING
    │
    ▼
ADMIN REVIEW
    │
    ├── NO ACTION
    ├── WARNING
    ├── HIDE CONTENT
    ├── SUSPEND 30 DAYS
    └── SUSPEND PERMANENT
```

Setiap tindakan moderasi dapat dicatat sebagai activity log.

---

# 🤖 Robot Security

Forum memiliki system account:

```text
Robot Security
```

Robot Security digunakan sebagai identitas publik untuk pengumuman keamanan sistem.

Contoh event:

```text
ACCOUNT SUSPENDED
CONTENT MODERATED
SECURITY EVENT
```

Identitas admin internal tidak ditampilkan sebagai identitas publik Robot Security.

---

# 🛡️ Account Suspension

Account dapat mempunyai status:

```text
active
suspended
```

Suspension mempunyai tipe:

```text
temporary
permanent
```

Temporary suspension mempunyai tanggal berakhir.

Permanent suspension tidak mempunyai tanggal berakhir otomatis.

Ketika account disuspend:

```text
Account
   ↓
Suspended
   ↓
Active Sessions Revoked
   ↓
User Cannot Access Protected API
```

Jika user merupakan reseller approved, reseller verification juga dapat dicabut ketika suspension diberlakukan.

---

# 🧑‍💼 Admin Dashboard

Admin dashboard menyediakan informasi sistem seperti:

- Total users
- Total posts
- Total comments
- Total ratings
- Total reports
- Total follows
- Total likes
- Total reseller applications
- Recent users
- Recent posts
- Recent reports
- Recent activities

Dashboard hanya dapat diakses oleh role yang mempunyai hak administrasi.

---

# 👮 Admin Management

Admin mempunyai beberapa halaman management.

```text
/admin.html
/admin-users.html
/admin-posts.html
/admin-reports.html
/admin-resellers.html
```

### User Management

Admin dapat melihat:

- Username
- Email
- Role
- Verified status
- Account status
- Reseller status
- Followers
- Following
- Posts
- Last login
- Bio

### Post Management

Admin dapat melihat:

- Author
- Title
- Content
- Type
- Category
- Visibility
- Status
- Media
- Price
- Stock
- Likes
- Comments
- Ratings

### Report Management

Admin dapat melakukan review terhadap report yang masuk.

### Reseller Management

Admin dapat melakukan:

```text
Approve
Reject
Suspend
Reinstate
```

terhadap reseller application sesuai statusnya.

---

# 🔎 Search

Forum menyediakan halaman search:

```text
/search.html
```

Search dapat digunakan untuk mencari posting berdasarkan:

- Title
- Content
- Username
- Category
- Subcategory

Search juga mendukung filter:

```text
All
Posts
Products
Users
```

---

# 👤 Profile

Halaman profile:

```text
/profile.html
```

Profile menampilkan:

- Avatar
- Username
- Verified badge
- Role
- Bio
- Followers
- Following
- Post count
- Follow button
- Post list

Tab profile:

```text
All
Products
Media
```

Profile mendukung pagination.

Default maksimal:

```text
20 posts
```

Private post hanya ditampilkan kepada pengguna yang mempunyai hak akses.

---

# ⚙️ Settings

Halaman settings:

```text
/settings.html
```

Pengguna dapat mengubah:

```text
Avatar
Bio
```

Data account seperti:

```text
Username
Email
```

tidak dapat diubah melalui endpoint profile update biasa.

---

# 🏪 Reseller Center

Halaman reseller:

```text
/reseller.html
```

Pengguna dapat mengajukan reseller verification.

Data application:

```text
Business Name
Description
Contact
Evidence
```

Status application:

```text
none
pending
approved
rejected
suspended
```

---

# 📝 Create Post

Halaman:

```text
/create-post.html
```

Pengguna yang sudah login dapat membuat:

```text
Post
Product
```

Product mempunyai field tambahan:

```text
Title
Price
Stock
```

Semua post mempunyai:

```text
Content
Category
Subcategory
Visibility
Media
```

---

# 📚 API Structure

API project menggunakan struktur modular.

```text
api/
├── auth/
│   ├── register.js
│   ├── login.js
│   ├── me.js
│   └── logout.js
│
├── admin/
│   ├── users.js
│   ├── posts.js
│   └── dashboard.js
│
├── comments/
│   ├── create.js
│   ├── list.js
│   ├── delete.js
│   └── like.js
│
├── follows/
│   ├── toggle.js
│   └── list.js
│
├── posts/
│   ├── create.js
│   ├── list.js
│   ├── detail.js
│   ├── update.js
│   ├── delete.js
│   └── like.js
│
├── ratings/
│   ├── create.js
│   └── list.js
│
├── reports/
│   ├── create.js
│   ├── list.js
│   └── action.js
│
├── reseller/
│   ├── apply.js
│   ├── list.js
│   └── action.js
│
├── profile/
│   ├── detail.js
│   └── update.js
│
├── security/
│   └── robot.js
│
├── middleware/
│   ├── auth.js
│   ├── admin.js
│   └── developer.js
│
└── db.js
```

---

# 🗄️ Database Structure

MongoDB database:

```text
userfjb
```

Collections utama:

```text
users
sessions
posts
comments
likes
follows
ratings
reports
resellerApplications
verificationHistory
activityLogs
```

---

# 🧩 Models

Model database:

```text
models/
├── User.js
├── Session.js
├── Post.js
├── Comment.js
├── Like.js
├── Follow.js
├── Rating.js
├── Report.js
├── ResellerApplication.js
├── VerificationHistory.js
└── ActivityLog.js
```

---

# 📁 Frontend Structure

Frontend berada di:

```text
public/
```

Halaman utama:

```text
public/
├── index.html
├── login.html
├── register.html
├── forum.html
├── profile.html
├── post.html
├── create-post.html
├── search.html
├── settings.html
├── reseller.html
│
├── admin.html
├── admin-users.html
├── admin-posts.html
├── admin-reports.html
└── admin-resellers.html
```

---

# 🔌 API Endpoint

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

## Posts

```text
POST /api/posts/create
GET  /api/posts/list
GET  /api/posts/detail
PUT  /api/posts/update
DELETE /api/posts/delete
POST /api/posts/like
```

## Comments

```text
POST /api/comments/create
GET  /api/comments/list
POST /api/comments/delete
POST /api/comments/like
```

## Follow

```text
POST /api/follows/toggle
GET  /api/follows/list
```

## Rating

```text
POST /api/ratings/create
GET  /api/ratings/list
```

## Reports

```text
POST /api/reports/create
GET  /api/reports/list
POST /api/reports/action
```

## Reseller

```text
POST /api/reseller/apply
GET  /api/reseller/list
POST /api/reseller/action
```

## Profile

```text
GET  /api/profile/detail
PUT  /api/profile/update
```

## Security

```text
GET /api/security/robot
```

## Admin

```text
GET /api/admin/users
GET /api/admin/posts
GET /api/admin/dashboard
```

## Health

```text
GET /api/health
```

---

# ⚙️ Requirements

Sebelum menjalankan project, pastikan sudah tersedia:

```text
Node.js 20+
npm
MongoDB
Git
```

---

# 🚀 Installation

Clone repository:

```bash
git clone https://github.com/reyclouddev-ops/FJB-ReyCode.git
```

Masuk ke folder:

```bash
cd FJB-ReyCode
```

Install dependency:

```bash
npm install
```

---

# 🔑 Environment Variable

Buat environment variable:

```text
MONGO_URI
```

Contoh:

```text
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

Database yang digunakan project:

```text
userfjb
```

Jangan commit credential MongoDB ke repository.

---

# ▶️ Menjalankan Project

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Default server:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

---

# 🧪 Development

Struktur development dibuat agar fitur dapat ditambahkan secara modular.

Contoh penambahan API:

```text
api/
└── feature/
    └── action.js
```

Kemudian route dapat didaftarkan melalui:

```text
server.js
```

Model baru dapat ditambahkan melalui:

```text
models/
```

Frontend baru dapat ditambahkan melalui:

```text
public/
```

---

# 🔄 Authentication Example

Login:

```http
POST /api/auth/login
Content-Type: application/json
```

Body:

```json
{
  "username": "reycode",
  "password": "password"
}
```

Response:

```json
{
  "status": true,
  "message": "Login berhasil",
  "user": {
    "username": "reycode"
  }
}
```

Browser kemudian menerima:

```text
fjb_session
```

Cookie tersebut digunakan untuk request authenticated berikutnya.

---

# 📦 Project Architecture

Secara sederhana:

```text
                   ┌───────────────┐
                   │    Browser    │
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │   Express.js  │
                   └───────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Auth API      Forum API      Admin API
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    ┌─────────────┐
                    │  Mongoose   │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   MongoDB   │
                    │   userfjb   │
                    └─────────────┘
```

---

# 🛡️ Moderation Architecture

Moderation tidak hanya bergantung pada frontend.

Backend melakukan pengecekan:

```text
Authentication
      ↓
Authorization
      ↓
Account Status
      ↓
Content Status
      ↓
Visibility
      ↓
Action
```

Contoh private post:

```text
Request
   ↓
Is Logged In?
   ↓
Is Owner/Admin/Developer?
   ↓
Allow
```

Jika tidak memenuhi:

```text
403 Forbidden
```

---

# 📊 Activity Logging

Sistem activity log digunakan untuk mencatat aktivitas penting.

Contoh action:

```text
register
login
logout
profile_update
password_change

post_create
post_update
post_delete
post_like
post_unlike

comment_create
comment_delete
comment_like
comment_unlike

follow
unfollow

rating_create
rating_update
rating_delete

report_create
report_review

reseller_apply
reseller_approve
reseller_reject
reseller_suspend
reseller_revoke

account_suspend
account_unsuspend
account_warning

content_hide
content_restore

admin_action
security_event
```

---

# 📌 Status Project

```text
Project       : Forum FJB ReyCode
Version       : 1.0.0
Runtime       : Node.js 20+
Framework     : Express.js 5
Database      : MongoDB
ODM           : Mongoose 8
Authentication: MongoDB Session
Frontend      : HTML / CSS / JavaScript
Status        : Active Development
```

---

# 🗺️ Roadmap

Roadmap dapat berkembang mengikuti kebutuhan project.

### Authentication

```text
[x] Register
[x] Login
[x] Logout
[x] Session
[x] HttpOnly Cookie
[x] Session Expiration
[x] Account Suspension
```

### User

```text
[x] Profile
[x] Avatar
[x] Bio
[x] Followers
[x] Following
[x] User Statistics
```

### Forum

```text
[x] Create Post
[x] Product Post
[x] Multiple Media
[x] Public Post
[x] Private Post
[x] Like
[x] Comment
[x] Reply
[x] Rating
```

### Marketplace

```text
[x] Product Listing
[x] Price
[x] Stock
[x] Category
[x] Subcategory
[x] Reseller System
```

### Moderation

```text
[x] Reports
[x] Admin Dashboard
[x] User Management
[x] Post Management
[x] Reseller Management
[x] Account Suspension
[x] Robot Security
[x] Activity Log
```

### Future Development

```text
[ ] Notification System
[ ] Direct Messaging
[ ] Advanced Search
[ ] Media Upload Service
[ ] Marketplace Transaction System
[ ] Payment Integration
[ ] Advanced Moderation
[ ] Notification Center
```

---

# 🔒 Security Notice

Jangan menyimpan informasi sensitif di repository.

Jangan commit:

```text
.env
MongoDB credentials
API keys
Private tokens
Session secrets
Service credentials
```

Gunakan environment variables untuk credential production.

Contoh:

```text
MONGO_URI
API_KEY
SECRET_KEY
```

Jika credential pernah ter-publish, segera lakukan rotation.

---

# 🤝 Contributing

Pull Request dan improvement dapat dilakukan dengan mengikuti struktur project.

Flow:

```text
Fork
  ↓
Create Branch
  ↓
Develop
  ↓
Test
  ↓
Commit
  ↓
Pull Request
```

Contoh:

```bash
git checkout -b feature/new-feature
```

Kemudian:

```bash
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
```

---

# 🐛 Bug Report

Jika menemukan bug, sertakan:

```text
Operating System
Node.js Version
Browser
Error Message
Steps To Reproduce
Expected Result
Actual Result
```

Jangan menyertakan:

```text
Password
API Key
MongoDB URI
Session Cookie
Private Token
```

---

# 📜 License

Project ini merupakan project **Forum FJB ReyCode**.

Penggunaan, distribusi, dan modifikasi mengikuti ketentuan license yang ditentukan oleh pemilik repository.

Jika repository memiliki file `LICENSE`, jadikan file tersebut sebagai referensi utama.

---

# 🌐 ReyCode

**ReyCode** adalah ecosystem untuk pengembangan software, API, automation, cloud, hosting, dan berbagai project digital.

```text
BUILD
CODE
CREATE
```

---

<div align="center">

### 🛒 Forum FJB ReyCode

**Community • Marketplace • Forum**

Built with ❤️ using Node.js, Express & MongoDB.

⭐ Jika project ini bermanfaat, jangan lupa berikan Star.

</div>
