# ✅ 新功能：支持用户名/邮箱登录

## 🎉 功能说明

现在登录时可以使用**用户名**或**邮箱**进行登录，更加灵活方便！

## 📝 修改内容

### 1. 后端修改

#### `services/auth-service/app/main.py`

修改登录逻辑，支持用户名或邮箱查询：

```python
@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, session: Session = Depends(get_db)):
    """Login user and return JWT token (supports email or username)"""
    # Try to find user by email or username
    user = session.query(User).filter(
        (User.email == credentials.email) | (User.username == credentials.email)
    ).first()

    if not user:
        raise AuthenticationError("Invalid email/username or password")
    
    # ... 验证密码和生成 token
```

#### `shared/python/common/schemas.py`

修改 `UserLogin` schema，允许接受任意字符串：

```python
class UserLogin(BaseModel):
    email: str  # Can be email or username
    password: str
```

**修改前：** `email: EmailStr`（只能是邮箱格式）
**修改后：** `email: str`（可以是邮箱或用户名）

### 2. 前端修改

#### `frontend/src/pages/Login.tsx`

更新登录表单的标签和提示：

**标签：**
- 注册模式：`Email`
- 登录模式：`Email or Username`

**输入框类型：**
- 注册模式：`type="email"`（强制邮箱格式）
- 登录模式：`type="text"`（允许任意文本）

**占位符：**
- 注册模式：`name@cypherguard.ai`
- 登录模式：`email or username`

```tsx
<label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
  {isRegisterMode ? 'Email' : 'Email or Username'}
</label>
<input
  type={isRegisterMode ? "email" : "text"}
  placeholder={isRegisterMode ? "name@cypherguard.ai" : "email or username"}
  // ...
/>
```

## 🧪 测试验证

### 测试 1：使用邮箱登录

```bash
POST /auth/login
Body: {
  "email": "test@example.com",
  "password": "test123"
}

Response: 200 OK
{
  "access_token": "eyJ...",
  "user": {...}
}
```

✅ **成功！**

### 测试 2：使用用户名登录

```bash
POST /auth/login
Body: {
  "email": "testuser",
  "password": "test123"
}

Response: 200 OK
{
  "access_token": "eyJ...",
  "user": {...}
}
```

✅ **成功！**

### 测试 3：错误的用户名/邮箱

```bash
POST /auth/login
Body: {
  "email": "wronguser",
  "password": "test123"
}

Response: 401 Unauthorized
{
  "detail": "Invalid email/username or password"
}
```

✅ **正确处理！**

## 🎯 使用方法

### 前端界面

1. **访问登录页面：** http://localhost:5174

2. **切换到登录模式：**
   - 点击 "Already have an account? Sign in"

3. **输入凭证：**
   - 可以输入邮箱：`test@example.com`
   - 或者输入用户名：`testuser`
   - 输入密码：`test123`

4. **点击 "Authenticate"**

5. **✅ 成功登录！**

### API 调用

```bash
# 使用邮箱登录
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 使用用户名登录
curl -X POST http://localhost/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser","password":"test123"}'
```

## 📊 功能对比

| 功能 | 修改前 | 修改后 |
|------|--------|--------|
| 登录方式 | 仅邮箱 | 邮箱或用户名 |
| 输入验证 | EmailStr（严格） | str（灵活） |
| 错误提示 | "Invalid email or password" | "Invalid email/username or password" |
| 用户体验 | 必须记住邮箱 | 可以用邮箱或用户名 |

## 🔒 安全性

### 保持的安全特性

✅ **密码验证** - 使用 bcrypt 哈希验证
✅ **JWT Token** - 安全的身份认证
✅ **错误信息** - 不泄露用户是否存在
✅ **SQL 注入防护** - 使用 SQLAlchemy ORM

### 查询逻辑

```python
# 使用 OR 查询，同时匹配邮箱和用户名
user = session.query(User).filter(
    (User.email == credentials.email) | (User.username == credentials.email)
).first()
```

这个查询是安全的，因为：
1. 使用 ORM 参数化查询
2. 不会泄露用户是否存在
3. 错误信息统一

## 💡 实现细节

### 为什么修改 schema？

**问题：** Pydantic 的 `EmailStr` 类型会验证输入必须是有效的邮箱格式，如果输入用户名会报错：

```
"value is not a valid email address: The email address is not valid. 
It must have exactly one @-sign."
```

**解决：** 将 `email: EmailStr` 改为 `email: str`，允许接受任意字符串。

### 为什么字段名还叫 email？

为了保持 API 兼容性，字段名保持为 `email`，但实际上可以接受邮箱或用户名。

**注释说明：**
```python
email: str  # Can be email or username
```

## 🎨 前端 UI 改进

### 登录模式

```
┌─────────────────────────────────┐
│  EMAIL OR USERNAME              │
│  ┌───────────────────────────┐  │
│  │ 📧 email or username      │  │
│  └───────────────────────────┘  │
│                                 │
│  PASSWORD                       │
│  ┌───────────────────────────┐  │
│  │ 🔒 ••••••••••••          │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │     Authenticate    →     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 注册模式

```
┌─────────────────────────────────┐
│  EMAIL                          │
│  ┌───────────────────────────┐  │
│  │ 📧 name@cypherguard.ai   │  │
│  └───────────────────────────┘  │
│                                 │
│  USERNAME                       │
│  ┌───────────────────────────┐  │
│  │ 👤 username              │  │
│  └───────────────────────────┘  │
│                                 │
│  PASSWORD                       │
│  ┌───────────────────────────┐  │
│  │ 🔒 ••••••••••••          │  │
│  └───────────────────────────┘  │
│  Minimum 6 characters           │
│                                 │
│  ┌───────────────────────────┐  │
│  │   Create Account    →     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## 🔄 升级步骤

如果你已经在运行旧版本，需要：

1. **重新构建 auth-service：**
   ```bash
   docker-compose build --no-cache auth-service
   ```

2. **重启服务：**
   ```bash
   docker-compose up -d auth-service
   ```

3. **重新构建前端：**
   ```bash
   cd frontend
   npm run build
   ```

4. **刷新浏览器：**
   - 硬刷新（Ctrl+F5）
   - 或清除缓存

## 📝 API 文档更新

### POST /auth/login

**请求体：**
```json
{
  "email": "string (email or username)",
  "password": "string"
}
```

**响应：**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "string",
    "username": "string",
    "role": "string",
    "created_at": "datetime"
  }
}
```

**错误响应：**
```json
{
  "detail": "Invalid email/username or password"
}
```

## ✅ 验证清单

- [x] 后端支持用户名查询
- [x] 后端支持邮箱查询
- [x] Schema 允许任意字符串
- [x] 前端标签更新
- [x] 前端输入类型更新
- [x] 前端占位符更新
- [x] 错误信息更新
- [x] 测试用户名登录
- [x] 测试邮箱登录
- [x] 测试错误处理
- [x] 文档更新

## 🎉 总结

现在用户可以更灵活地登录系统：
- ✅ 使用邮箱登录
- ✅ 使用用户名登录
- ✅ 更好的用户体验
- ✅ 保持安全性

**立即体验：http://localhost:5174** 🚀
