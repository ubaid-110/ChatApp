import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'image') {
      cb(null, 'uploads/images/');
    } else if (file.fieldname === 'audio') {
      cb(null, 'uploads/audios/');
    } else {
      cb(new Error('Invalid fieldname'), false);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // audio ke liye hamesha .webm extension use karo
    const ext = file.fieldname === 'audio' ? '.webm' : path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'image') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  } 
  else if (file.fieldname === 'audio') {
    // Browser audio/webm;codecs=opus bhi bhejta hai — startsWith use karo
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/webm') // Firefox webm ko video/webm bhejta hai
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  } 
  else {
    cb(null, false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export default upload;
