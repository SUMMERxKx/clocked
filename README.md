# Clocked - Secure Activity Tracking App

A production-grade mobile-first application for tracking activities within private groups, featuring real-time collaboration, privacy controls, and comprehensive security measures.

## 🚀 Features

- **Secure Authentication**: Passwordless magic links + OAuth (Google/Apple)
- **Private Groups**: Create and join groups with role-based access control
- **Activity Tracking**: Clock in/out of sessions with categories and goals
- **Real-time Updates**: WebSocket-powered live status broadcasting
- **Privacy Controls**: Granular privacy settings and data minimization
- **Mobile-First**: React Native app with offline support
- **Production Ready**: Comprehensive monitoring, logging, and security

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Web Client    │    │   Admin Panel   │
│  (React Native) │    │   (React SPA)   │    │   (React SPA)   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      Load Balancer        │
                    │      (AWS ALB)            │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     API Server           │
                    │   (Node.js + Fastify)    │
                    │   + WebSocket Hub        │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────┴─────────┐    ┌─────────┴─────────┐    ┌─────────┴─────────┐
│   PostgreSQL      │    │      Redis        │    │   File Storage    │
│   (Primary DB)    │    │   (Cache/Queue)   │    │     (S3)          │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify (high-performance HTTP server)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and rate limiting
- **Auth**: JWT with refresh token rotation
- **Real-time**: WebSockets with Socket.IO
- **Validation**: Zod schemas
- **Logging**: Pino structured logging

### Mobile
- **Framework**: React Native with Expo
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Navigation**: React Navigation 6
- **Storage**: AsyncStorage + SecureStore
- **Notifications**: Expo Notifications

### Infrastructure
- **Cloud**: AWS (ECS Fargate, RDS, ElastiCache)
- **Container**: Docker with multi-stage builds
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: CloudWatch, Sentry
- **Security**: AWS Secrets Manager, VPC, WAF

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/clocked.git
   cd clocked
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy example files
   cp server/env.example server/.env
   cp mobile/.env.example mobile/.env
   
   # Edit the files with your configuration
   nano server/.env
   nano mobile/.env
   ```

4. **Start the database**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start the development servers**
   ```bash
   # Start both server and mobile in development mode
   npm run dev
   
   # Or start individually
   npm run dev:server  # Server on http://localhost:3000
   npm run dev:mobile  # Mobile app (Expo)
   ```

### Environment Variables

#### Server (.env)
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/clocked"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"
HOST="0.0.0.0"

# Redis
REDIS_URL="redis://localhost:6379"

# Email (for magic links)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Clocked <noreply@clocked.app>"
```

#### Mobile (.env)
```bash
# API
EXPO_PUBLIC_API_URL="http://localhost:3000"
EXPO_PUBLIC_WS_URL="ws://localhost:3000"

# App
EXPO_PUBLIC_APP_NAME="Clocked"
EXPO_PUBLIC_APP_VERSION="1.0.0"

# Features
EXPO_PUBLIC_ENABLE_NOTIFICATIONS=true
EXPO_PUBLIC_ENABLE_LOCATION=false
```

## 📱 Mobile App Setup

1. **Install Expo CLI**
   ```bash
   npm install -g @expo/cli
   ```

2. **Start the mobile app**
   ```bash
   cd mobile
   npm start
   ```

3. **Run on device/simulator**
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal
   - Or press `i` for iOS simulator, `a` for Android emulator

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
# Server tests
npm run test:server

# Mobile tests
npm run test:mobile

# With coverage
npm run test:coverage
```

### Test database setup
```bash
# Reset test database
npm run db:reset

# Seed test data
npm run db:seed
```

## 🚀 Deployment

### Staging Deployment
```bash
# Deploy to staging
git push origin develop
# GitHub Actions will automatically deploy to staging
```

### Production Deployment
```bash
# Deploy to production
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions will automatically deploy to production
```

### Manual Infrastructure Deployment
```bash
cd infra

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file=production.tfvars

# Apply changes
terraform apply -var-file=production.tfvars
```

## 📊 Monitoring & Observability

### Health Checks
- **API Health**: `GET /health`
- **Database**: Connection and query performance
- **Redis**: Connection and memory usage
- **WebSocket**: Connection count and message throughput

### Logs
- **Structured Logging**: JSON format with request IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Log Aggregation**: CloudWatch Logs
- **Error Tracking**: Sentry integration

### Metrics
- **Application**: Request rate, response time, error rate
- **Infrastructure**: CPU, memory, disk usage
- **Business**: Active users, sessions started, groups created

## 🔒 Security

### Authentication & Authorization
- **Passwordless**: Magic link authentication
- **OAuth**: Google and Apple Sign-In
- **JWT**: Short-lived access tokens (15 minutes)
- **Refresh Tokens**: Long-lived with rotation (7 days)
- **RBAC**: Role-based access control (Owner, Admin, Member)

### Data Protection
- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Row-Level Security**: PostgreSQL RLS policies
- **Data Minimization**: Only collect necessary data
- **Privacy Controls**: User-configurable privacy settings

### Infrastructure Security
- **VPC**: Private subnets for databases
- **Security Groups**: Restrictive firewall rules
- **Secrets Management**: AWS Secrets Manager
- **Container Security**: Non-root users, minimal base images

## 📚 API Documentation

### Authentication Endpoints
- `POST /v1/auth/magic-link` - Request magic link
- `POST /v1/auth/magic-link/verify` - Verify magic link
- `POST /v1/auth/refresh` - Refresh access token
- `POST /v1/auth/logout` - Logout user
- `GET /v1/auth/me` - Get current user
- `PATCH /v1/auth/me` - Update user profile

### Group Endpoints
- `GET /v1/groups` - List user's groups
- `POST /v1/groups` - Create new group
- `GET /v1/groups/:id` - Get group details
- `PATCH /v1/groups/:id` - Update group
- `DELETE /v1/groups/:id` - Delete group
- `POST /v1/groups/:id/invite` - Invite member
- `POST /v1/groups/join` - Join group with invite token

### Session Endpoints
- `POST /v1/sessions` - Start new session
- `GET /v1/sessions/group/:groupId` - Get group sessions
- `GET /v1/sessions/me` - Get user's sessions
- `PATCH /v1/sessions/:id` - Update session
- `POST /v1/sessions/:id/reactions` - Add reaction
- `DELETE /v1/sessions/:id/reactions/:reactionId` - Remove reaction

### WebSocket Events
- `session_started` - User started a session
- `session_ended` - User ended a session
- `reaction_added` - User added a reaction
- `member_joined` - New member joined group

## 🛠️ Development

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb config with custom rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for linting

### Git Workflow
- **Branch Strategy**: Trunk-based development
- **Commit Messages**: Conventional Commits
- **Pull Requests**: Required for all changes
- **Code Review**: At least one approval required

### Database Migrations
```bash
# Create new migration
cd server
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset
```

## 📖 Additional Documentation

- [Security Guide](SECURITY.md) - Comprehensive security documentation
- [Privacy Policy](PRIVACY.md) - Data handling and privacy controls
- [Runbook](RUNBOOK.md) - Operational procedures and troubleshooting
- [API Reference](API.md) - Detailed API documentation
- [Mobile Test Plan](MOBILE_TESTPLAN.md) - E2E testing scenarios

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the docs/ folder
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Security**: security@clocked.app for security issues

## 🎯 Roadmap

- [ ] Push notifications with deep linking
- [ ] Advanced analytics and insights
- [ ] Team collaboration features
- [ ] Integration with calendar apps
- [ ] Desktop application
- [ ] API rate limiting improvements
- [ ] Advanced privacy controls
- [ ] Multi-language support

---

Built with ❤️ by the Clocked team
