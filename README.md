# PsychData

A privacy-first platform for conducting online psychology experiments, enabling researchers to collect encrypted participant responses while performing fully homomorphic encrypted (FHE) statistical analysis. This ensures data privacy while allowing meaningful insights without exposing individual answers.

## Overview

Modern psychological research often requires online data collection. Traditional methods face challenges such as:

• Data privacy concerns: Participants may hesitate to provide honest responses if data is not fully protected
• Regulatory compliance: Handling sensitive participant data requires strict adherence to ethics and privacy laws
• Aggregation limitations: Researchers cannot perform secure analysis without accessing raw data

PsychData addresses these issues by encrypting all participant responses and enabling FHE-based statistical computation, allowing researchers to analyze data securely without ever decrypting individual responses.

## Features

### Core Experiment Functionality

• Experiment Builder: Create and customize online experiments with multiple question types
• Encrypted Data Collection: Participants' responses are encrypted on their devices before submission
• FHE Statistical Analysis: Perform computations like ANOVA, t-tests, and summary statistics directly on encrypted data
• Participant Management: Track experiment completion anonymously
• Results Dashboard: View aggregate statistics and insights while maintaining full privacy

### Privacy & Security

• Client-side Encryption: Data is encrypted before leaving the participant's browser
• End-to-End Encryption: Only encrypted data is transmitted and stored
• Fully Homomorphic Encryption: Enables computations on encrypted responses without exposing raw data
• Ethical Compliance: Built to align with academic research standards and IRB guidelines
• Immutable Storage: Experiment submissions cannot be altered after encryption

### Researcher Tools

• Experiment Templates: Predefined setups for common psychological studies
• FHE Computation Library: Integrated routines for secure statistical analysis
• Exportable Aggregates: Download aggregated, encrypted statistics for publications or further analysis
• Real-time Monitoring: Track encrypted submission counts and experiment status
• Anonymized Feedback: Optionally gather qualitative feedback without compromising participant privacy

## Architecture

### Frontend

• JavaScript/React: Dynamic experiment interfaces and dashboards
• Data Encryption Modules: Encrypt responses using advanced client-side FHE protocols
• Responsive Design: Works across desktop and mobile devices

### Backend

• Python Server: Handles experiment orchestration, data storage, and encrypted computation
• Encrypted Storage: Databases store only encrypted participant responses
• FHE Computation Engine: Processes aggregate statistics securely without accessing raw data
• Audit Logs: Immutable records of experiment events and data submissions

## Technology Stack

• Languages: JavaScript, Python
• Libraries: FHE libraries, React, encryption utilities
• Storage: Encrypted databases, secure cloud storage
• Deployment: Dockerized for reproducible research environments

## Installation

### Prerequisites

• Node.js 18+
• Python 3.10+
• Package managers (npm / yarn / pip)
• Optional: Docker for containerized deployment

### Setup

1. Clone the repository
2. Install frontend dependencies: `npm install`
3. Install backend dependencies: `pip install -r requirements.txt`
4. Configure FHE keys and experiment database
5. Start frontend and backend services

## Usage

• Create Experiment: Use the builder interface to define experiment structure
• Share Link: Participants access the experiment securely via a generated URL
• Collect Responses: Data is encrypted on the client side and stored safely
• Run Analysis: Perform FHE-based statistical tests without decrypting individual responses
• Review Results: Access aggregate insights and anonymized visualizations

## Security Considerations

• End-to-End Encryption ensures raw responses never leave participant devices
• FHE-based Analysis prevents exposure of individual data
• Audit Trails maintain integrity and reproducibility
• Compliance with academic ethical standards protects participant rights

## Future Roadmap

• Expand statistical tests available under FHE (e.g., regression, correlation analysis)
• Multi-experiment dashboards with secure aggregate comparisons
• Mobile-optimized interface for participant convenience
• Integration with collaborative research platforms
• AI-driven anonymized feedback summarization

Built with ❤️ to enable privacy-preserving psychology research and secure statistical insights.
