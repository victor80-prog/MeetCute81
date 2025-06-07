# MeetCute - Modern Dating Platform

MeetCute is a full-featured dating application designed to create meaningful connections between users. With a robust feature set spanning from user matching algorithms to premium subscription services, MeetCute delivers a complete dating experience.

## 🚀 Features

### User Features
- **Smart Matching System**: Algorithm-based matching considering user preferences and behavior
- **User Profiles**: Detailed profile creation with photos, personal information, interests, and preferences
- **Messaging System**: Real-time chat with matches, including read receipts and typing indicators
- **Discovery Feed**: Browse potential matches with filtering options
- **Premium Subscriptions**: Tiered subscription plans with escalating benefits
- **Virtual Gifts**: Send and receive virtual gifts to express interest
- **Notifications**: Real-time notifications for matches, messages, and profile views

### Admin Features
- **Dashboard**: Comprehensive statistics and metrics for monitoring platform performance
- **User Management**: View, edit, and manage user accounts
- **Moderation Tools**: Review reported content and take appropriate actions
- **Revenue Tracking**: Monitor subscription payments and financial performance
- **Subscription Management**: Create, edit, and manage subscription tiers and features
- **Admin Action Logs**: Track all administrative actions for accountability

## 🛠️ Technology Stack

### Frontend
- **React**: Component-based UI library
- **React Router**: Navigation and routing
- **Axios**: HTTP client for API requests
- **Tailwind CSS**: Utility-first CSS framework
- **React Icons**: Icon library
- **Socket.io Client**: Real-time communication

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web application framework
- **PostgreSQL**: Relational database
- **WebSockets**: Real-time communication
- **JWT**: Authentication via JSON Web Tokens
- **Bcrypt**: Password hashing
- **Nodemailer**: Email notifications

## 🗂️ Project Structure

### Frontend Structure
```
frontend/
├── public/          # Static files
├── src/             # Source code
│   ├── components/  # Reusable React components
│   │   ├── Admin/   # Admin dashboard components
│   │   ├── Auth/    # Authentication components
│   │   ├── Chat/    # Messaging components
│   │   └── ...      # Other component categories
│   ├── pages/       # Page components
│   ├── utils/       # Utility functions and services
│   ├── hooks/       # Custom React hooks
│   ├── context/     # React context providers
│   ├── App.jsx      # Main application component
│   └── main.jsx     # Application entry point
├── package.json     # Project dependencies
└── vite.config.js   # Vite configuration
```

### Backend Structure
```
backend/
├── config/          # Configuration files
│   ├── db.js        # Database connection
│   └── env.js       # Environment variables
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── models/          # Database models
├── routes/          # API route definitions
├── uploads/         # User uploaded files
├── utils/           # Utility functions
├── websocket/       # WebSocket server setup
├── package.json     # Project dependencies
└── server.js        # Server entry point
```

## 📊 Database Schema

MeetCute uses a PostgreSQL database with the following core tables:

- **users**: User accounts and authentication
- **profiles**: User profile information
- **matches**: Connections between users
- **messages**: User-to-user communications
- **subscription_packages**: Available subscription tiers
- **subscription_features**: Features included in each package
- **user_subscriptions**: User subscription status
- **transactions**: Payment records
- **reported_content**: User reports for moderation
- **admin_logs**: Administrative action tracking

## 🚀 Installation and Setup

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

### Backend Setup
1. Clone the repository
   ```
   git clone https://github.com/yourusername/meetcute.git
   cd meetcute/backend
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file with required environment variables:
   ```
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   DB_NAME=meetcute
   JWT_SECRET=your-jwt-secret
   FRONTEND_URL=http://localhost:5173
   ```

4. Initialize the database
   ```
   psql -U postgres -c "CREATE DATABASE meetcute"
   psql -U postgres -d meetcute -f database/schema.sql
   ```

5. Start the server
   ```
   npm run dev
   ```

### Frontend Setup
1. Navigate to frontend directory
   ```
   cd ../frontend
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file:
   ```
   VITE_API_URL=http://localhost:5000
   VITE_SOCKET_URL=http://localhost:5000
   ```

4. Start the development server
   ```
   npm run dev
   ```

## 🔒 Authentication and Authorization

The application implements a JWT-based authentication system with the following user roles:
- **Regular**: Standard users with basic features
- **Premium**: Subscribed users with access to premium features
- **Admin**: Administrative users with access to the admin dashboard

## 💰 Subscription System

MeetCute offers a tiered subscription model:
- **Basic**: Entry-level features
- **Premium**: Enhanced features and visibility
- **Elite/VIP**: Full access to all platform features

Payment processing now supports a variety of country-specific payment methods, including manual verification flows like M-Pesa, bank transfers, PayPal (manual reference), and Bitcoin. Admins configure these methods per country, and users are guided through a process of paying externally and submitting a transaction reference for admin verification.

## 💳 Payment System

The new payment system is designed to be flexible and accommodate various payment methods, particularly those requiring manual verification.

### For Users:
1.  **Select Country & Method**: When making a payment (e.g., for a subscription), users first select their country. The system then displays available payment methods configured for that country.
2.  **View Instructions**: Upon selecting a method, users receive specific payment instructions (e.g., M-Pesa PayBill number, bank account details, PayPal email, BTC address).
3.  **Make Payment Externally**: Users complete the payment using the provided details through their chosen external service (M-Pesa app, bank app, PayPal website, BTC wallet).
4.  **Submit Reference**: After making the payment, users submit a payment reference (e.g., M-Pesa transaction code, bank transaction ID, PayPal transaction ID, BTC transaction hash) through the MeetCute platform.
5.  **Await Verification**: The transaction status becomes 'pending_verification'. Admins review these submissions.
6.  **Confirmation**: Once an admin verifies the payment, the transaction is marked 'completed', and the service (e.g., subscription) is activated. If declined, the transaction is marked 'declined'.

### For Administrators:
1.  **Global Payment Types**: Admins can define global payment method types (e.g., "M-Pesa", "PayPal", "Bank Transfer", "Bitcoin") with a unique code and description.
    *   Relevant API: `/api/admin/payment-methods/types`
2.  **Country-Specific Configuration**: For each country, admins can activate global payment types and provide specific configuration details and user instructions.
    *   **Examples**:
        *   For M-Pesa in Kenya: PayBill number, Account number instructions.
        *   For PayPal (globally or per country): PayPal email address for payments.
        *   For Bank Transfer in a specific country: Bank name, Account number, Beneficiary, SWIFT/BIC.
        *   For Bitcoin: BTC wallet address.
    *   Relevant API: `/api/admin/payment-configurations`
3.  **Transaction Verification Queue**: Admins have a dashboard to view transactions that are 'pending_verification'. They can review the user-submitted reference, compare it with external payment records (if applicable), and then approve ('completed') or decline the transaction. Admin notes can be added during verification.
    *   Relevant API: `/api/admin/transactions`

This system allows for a wider range of payment options beyond direct credit card processing, catering to diverse user preferences and regional payment habits.

## 🔍 Moderation System

The platform includes a robust moderation system that allows administrators to:
- Review reported content
- Take action against violating users
- Monitor platform activity through admin logs
- Maintain platform integrity

## 🔄 API Endpoints

The backend exposes the following primary API categories:
- `/api/auth`: Authentication and user registration
- `/api/user`: User profile management
- `/api/matches`: Match creation and management
- `/api/messages`: Messaging functionality
- `/api/admin`: Admin dashboard operations (stats, user management, moderation, etc.)
- `/api/subscription`: Manages subscription lifecycle post-payment verification.
- `/api/gifts`: Virtual gift functionality (may also integrate with new transaction system).
- `/api/profile`: Profile management
- `/api/countries`: Country data for location settings
- `/api/transactions`: User-facing transaction initiation, reference submission, and status tracking.
- `/api/admin/payment-methods/types`: Admin management of global payment method types.
- `/api/admin/payment-configurations`: Admin management of country-specific payment method setups.
- `/api/admin/transactions`: Admin management and verification of transactions.

## 📱 Responsive Design

The frontend is fully responsive, providing optimal user experience across:
- Desktop computers
- Tablets
- Mobile phones

## 🔮 Future Enhancements

Planned features for future development:
- Video chat integration
- AI-based matching improvements
- Enhanced analytics dashboard
- Mobile applications (iOS/Android)
- Internationalization support

## ⚖️ License

This project is proprietary software and is not open for redistribution or modification without explicit permission.

## 👥 Development Team

MeetCute is developed and maintained by a dedicated team of developers committed to creating the best dating platform experience.

---

© 2025 MeetCute. All Rights Reserved.
