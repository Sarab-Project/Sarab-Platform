# Sarab Platform

## Overview

Sarab Platform is a biomedical data management system designed to support the storage, organization, retrieval, and analysis of eye-tracking datasets. The platform provides a centralized environment where contributors can upload research data and researchers can browse, search, and analyze available datasets.

The system integrates AI-powered services, including Automatic Speech Recognition (ASR) and Eye Map Analysis, enabling advanced processing capabilities through external AI servers.

---

## Features

### Dataset Management

* Create and manage collections.
* Organize data using folders and samples.
* Upload and manage image and video files.
* Download selected files from samples.

### Search System

* Search datasets and samples using metadata and filtering criteria.
* Fast retrieval of research data.

### Authentication & Authorization

* User registration and login.
* JWT-based authentication.
* Role-based authorization.

### AI Services Integration

* Speech-to-Text (ASR) service integration.
* Eye Heatmaps service integration.
* Eye Slit lamp Tracking videos integration.
* Communication with external AI servers through REST APIs.

---

## Architecture

The system follows a hybrid architectural approach combining Client-Server Architecture, Microservices Architecture, and a layered backend design.

### Client-Server Architecture

The web and mobile applications act as clients that communicate with the backend through RESTful APIs.

### Microservices Architecture

AI-related functionalities are implemented as independent services. The backend communicates with external AI services responsible for Speech-to-Text (ASR) processing and Eye Map Analysis.

### Layered Backend Architecture

The backend is organized into multiple layers including Controllers, Services, Models, and Data Access components. This separation improves maintainability, scalability, and testability.

### High-Level Architecture

```text
Mobile Application /   Web Platform
   (Sarab-Ai)        (Sarab-Platform)
_____________________________________   
                │
                ▼
        ASP.NET Core Backend
                │
      ┌─────────┴─────────┐
      ▼                   ▼
 SQL Server         AI Services
 Database        (ASR & Analysis)
```

---

## Technologies Used

### Backend

* ASP.NET Core Web API
* Entity Framework Core
* JWT Authentication

### Frontend

* React
* TypeScript

### Database

* SQL Server

### DevOps

* Docker
* Docker Compose

### Testing

* xUnit
* FluentAssertions

### AI Integration

* Automatic Speech Recognition (ASR)
* Eye Heattmaps Service
* Eye Slit lamp Tracking videos

---

## Project Structure

```text
Sarab-Platform/
│
├── backend/
│   ├── Controllers/
│   ├── Services/
│   ├── Models/
│   ├── DTOs/
│   ├── Data/
│   └── Migrations/
│
├── frontend/
│
├── Docker/
│
└── Sarab-Platform.Tests/
```

---

## Installation & Setup

### Prerequisites

* .NET 10 SDK
* Node.js
* Docker
* Docker Compose

### Clone Repository

```bash
git clone https://github.com/Sarab-Project/Sarab-Platform.git
cd Sarab-Platform
```

---

## Running the Project

### 1. Build Backend Docker Image

```bash
cd backend
docker build -t sarab-backend .
```

### 2. Build Frontend Docker Image

```bash
cd ../frontend
docker build -t sarab-frontend .
```

### 3. Start the Complete Environment

```bash
cd ../Docker
docker compose up
```

This command starts all required services, including:

* Backend API
* Frontend Application
* SQL Server Database
* Supporting containers and services

### Stop the Environment

```bash
docker compose down
```

---

## API Documentation

The platform exposes RESTful APIs for:

* Authentication
* Collections Management
* Folder Management
* Sample Management
* File Upload and Download
* Search Operations
* Speech-to-Text (ASR)
* Eye Map Analysis

Interactive API documentation is available through Swagger when running the backend service.

---

## Testing

The project includes automated unit tests implemented using:

* xUnit
* FluentAssertions

### Tested Components

* FileService
* TokenService

### Run Tests

```bash
dotnet test
```

The tests verify:

* File handling operations
* File type validation
* JWT token generation
* Token claims integrity
