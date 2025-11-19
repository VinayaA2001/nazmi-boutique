import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration class."""
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', 'nazmi-boutique-secret-key-2025')
    JWT_SECRET = os.getenv('JWT_SECRET', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 86400))  # 24 hours
    
    # Database
    MONGO_URI = os.getenv('MONGO_URI')
    
    # Email Configuration
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USE_SSL = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', MAIL_USERNAME)
    MAIL_SUPPRESS_SEND = os.getenv('MAIL_SUPPRESS_SEND', 'False').lower() == 'true'
    
    # Payment Gateway
    RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
    RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')
    RAZORPAY_WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
    
    # Frontend URLs
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    ADMIN_FRONTEND_URL = os.getenv('ADMIN_FRONTEND_URL', 'http://localhost:3001')
    
    # CORS
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')
    
    # Application Settings
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    TESTING = os.getenv('TESTING', 'False').lower() == 'true'
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    
    # File Upload
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    
    # Rate Limiting
    RATELIMIT_ENABLED = os.getenv('RATELIMIT_ENABLED', 'True').lower() == 'true'
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '200 per day,50 per hour')
    
    # Cache
    CACHE_TYPE = os.getenv('CACHE_TYPE', 'simple')
    CACHE_DEFAULT_TIMEOUT = int(os.getenv('CACHE_DEFAULT_TIMEOUT', 300))
    
    @classmethod
    def validate_config(cls):
        """Validate that required environment variables are set"""
        required_vars = [
            'SECRET_KEY',
            'MONGO_URI',
            'RAZORPAY_KEY_ID', 
            'RAZORPAY_KEY_SECRET',
            'MAIL_USERNAME',
            'MAIL_PASSWORD'
        ]
        
        missing_vars = []
        for var in required_vars:
            value = getattr(cls, var)
            if not value:
                missing_vars.append(var)
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        # Validate MongoDB URI format
        if cls.MONGO_URI and not cls.MONGO_URI.startswith(('mongodb://', 'mongodb+srv://')):
            raise ValueError("Invalid MONGO_URI format. Must start with mongodb:// or mongodb+srv://")
        
        # Validate email configuration if not in testing mode
        if not cls.TESTING and not cls.MAIL_SUPPRESS_SEND:
            if not cls.MAIL_USERNAME or not cls.MAIL_PASSWORD:
                raise ValueError("Email credentials required when MAIL_SUPPRESS_SEND is False")
        
        return True
    
    @classmethod
    def get_all_settings(cls):
        """Return all settings as dict (excluding sensitive data)"""
        settings = {}
        for key in dir(cls):
            if not key.startswith('_') and not callable(getattr(cls, key)):
                # Hide sensitive information
                if any(sensitive in key.lower() for sensitive in ['key', 'secret', 'password']):
                    settings[key] = '***HIDDEN***'
                else:
                    settings[key] = getattr(cls, key)
        return settings


class DevelopmentConfig(Config):
    """Development specific configuration"""
    DEBUG = True
    TESTING = False
    ENVIRONMENT = 'development'
    
    # Development-specific settings
    MAIL_SUPPRESS_SEND = os.getenv('MAIL_SUPPRESS_SEND', 'False').lower() == 'true'
    PRESERVE_CONTEXT_ON_EXCEPTION = False


class ProductionConfig(Config):
    """Production specific configuration"""
    DEBUG = False
    TESTING = False
    ENVIRONMENT = 'production'
    
    # Production-specific settings
    MAIL_SUPPRESS_SEND = False
    PRESERVE_CONTEXT_ON_EXCEPTION = True
    
    # Security enhancements for production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Production CORS settings
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '').split(',')


class TestingConfig(Config):
    """Testing specific configuration"""
    TESTING = True
    DEBUG = True
    ENVIRONMENT = 'testing'
    
    # Testing database
    MONGO_URI = os.getenv('TEST_MONGO_URI', 'mongodb://localhost:27017/test_nazmi_boutique')
    
    # Disable email sending during tests
    MAIL_SUPPRESS_SEND = True
    
    # Testing-specific settings
    WTF_CSRF_ENABLED = False


class StagingConfig(Config):
    """Staging environment configuration"""
    DEBUG = False
    TESTING = False
    ENVIRONMENT = 'staging'
    
    # Staging-specific settings
    MAIL_SUPPRESS_SEND = os.getenv('MAIL_SUPPRESS_SEND', 'True').lower() == 'true'


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'staging': StagingConfig,
    'default': DevelopmentConfig
}


def get_config(config_name=None):
    """Get configuration class based on environment"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'default')
    
    config_class = config.get(config_name)
    if config_class is None:
        raise ValueError(f"Invalid configuration name: {config_name}")
    
    return config_class