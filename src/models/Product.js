import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  }
});

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  duration: {
    type: String,
    required: [true, 'La duración es obligatoria'],
    trim: true
  },
  level: {
    type: String,
    required: [true, 'El nivel es obligatorio'],
    enum: {
      values: ['Beginner', 'Intermediate', 'Advanced'],
      message: 'El nivel debe ser Beginner, Intermediate o Advanced'
    }
  },
  description: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true
  },
  classes: [classSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Actualizar la fecha de actualización antes de guardar
productSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Actualizar la fecha de actualización antes de actualizar
productSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;