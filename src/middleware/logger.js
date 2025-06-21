export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  console.log(`📥 ${req.method} ${req.originalUrl} - IP: ${req.ip} - ${new Date().toISOString()}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
    
    console.log(
      `📤 ${statusColor} ${res.statusCode} ${req.method} ${req.originalUrl} - ${duration}ms`
    );
  });

  next();
};

export const apiLogger = {
  info: (message, meta = {}) => {
    console.log(`ℹ️ [INFO] ${message}`, meta);
  },
  
  warn: (message, meta = {}) => {
    console.warn(`⚠️ [WARN] ${message}`, meta);
  },
  
  error: (message, error = {}) => {
    console.error(`❌ [ERROR] ${message}`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};
