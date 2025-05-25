const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Crear directorio uploads si no existe
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configuración para almacenamiento local
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    // Generar nombre único con timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  },
});

// Filtro para tipos de archivo permitidos
const fileFilter = (req, file, cb) => {
  // Verificar tipo de archivo
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  }
});

// Ruta para subir archivo local
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: 'No file uploaded' });
    }
    
    res.send({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      path: `/${req.file.path}`,
      url: `${req.protocol}://${req.get('host')}/${req.file.path}`
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Configuración para AWS S3 (opcional - requiere configuración adicional)
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  const multerS3 = require('multer-s3');
  const AWS = require('aws-sdk');

  // Configurar AWS
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
  });

  const s3 = new AWS.S3();

  const storageS3 = multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME || 'amazona-bucket',
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key(req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, `products/${file.fieldname}-${uniqueSuffix}${extension}`);
    },
  });

  const uploadS3 = multer({ 
    storage: storageS3,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB límite
    }
  });

  // Ruta para subir a S3
  router.post('/s3', uploadS3.single('image'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send({ message: 'No file uploaded' });
      }
      
      res.send({
        message: 'File uploaded to S3 successfully',
        url: req.file.location
      });
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  });
}

// Ruta para eliminar archivo local
router.delete('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.send({ message: 'File deleted successfully' });
    } else {
      res.status(404).send({ message: 'File not found' });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Middleware para manejar errores de multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send({ message: 'File too large. Maximum size is 5MB.' });
    }
  }
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).send({ message: error.message });
  }
  res.status(500).send({ message: error.message });
});

module.exports = router;