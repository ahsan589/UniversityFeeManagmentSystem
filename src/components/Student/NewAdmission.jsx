import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentsService, utils } from '../../services/firebaseService';
import './NewAdmission.css';

const NewAdmission = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    fatherName: '',
    contact: '',
    program: '',
    registrationFee: '',
    tuitionFee: '',
    examFee: '',
    universityShare: '',
    others: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [studentIdStatus, setStudentIdStatus] = useState({ 
    available: true, 
    checking: false, 
    message: '' 
  });

  // Check student ID availability
  const checkStudentIdAvailability = async (studentId) => {
    if (!studentId.trim()) {
      setStudentIdStatus({ 
        available: true, 
        checking: false, 
        message: '' 
      });
      return;
    }

    const formattedId = studentId.trim().toUpperCase();
    setStudentIdStatus(prev => ({ 
      ...prev, 
      checking: true 
    }));

    try {
      const isAvailable = await studentsService.isStudentIdAvailable(formattedId);
      setStudentIdStatus({ 
        available: isAvailable, 
        checking: false,
        message: isAvailable ? '✓ Available' : '✗ Already taken'
      });
    } catch (error) {
      setStudentIdStatus({ 
        available: false, 
        checking: false, 
        message: 'Error checking availability'
      });
    }
  };

  // Handle student ID change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.studentId) {
        checkStudentIdAvailability(formData.studentId);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.studentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'studentId') {
      // Format student ID to uppercase
      setFormData(prev => ({
        ...prev,
        [name]: value.toUpperCase()
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : parseFloat(value) || 0
    }));
  };

  const calculateTotal = () => {
    return utils.calculateTotalFees({
      registrationFee: parseFloat(formData.registrationFee) || 0,
      tuitionFee: parseFloat(formData.tuitionFee) || 0,
      examFee: parseFloat(formData.examFee) || 0,
      universityShare: parseFloat(formData.universityShare) || 0,
      others: parseFloat(formData.others) || 0
    });
  };

  const handleAutoGenerate = async () => {
    setStudentIdStatus({ 
      available: false, 
      checking: true, 
      message: 'Generating...' 
    });

    try {
      let studentId;
      let attempts = 0;
      
      do {
        studentId = studentsService.generateStudentId();
        attempts++;
        
        if (attempts > 10) {
          throw new Error('Unable to generate unique ID');
        }
      } while (!(await studentsService.isStudentIdAvailable(studentId)));
      
      setFormData(prev => ({ ...prev, studentId }));
      setStudentIdStatus({ 
        available: true, 
        checking: false, 
        message: '✓ Auto-generated' 
      });
    } catch (error) {
      setError('Failed to generate student ID. Please enter manually.');
      setStudentIdStatus({ 
        available: false, 
        checking: false, 
        message: '✗ Generation failed' 
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // Validate required fields
      const requiredFields = ['name', 'fatherName', 'contact', 'program'];
      const missingFields = requiredFields.filter(field => !formData[field].trim());
      
      if (missingFields.length > 0) {
        throw new Error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      }

      // Validate contact number
      const cleanContact = formData.contact.replace(/\D/g, '');
      if (cleanContact.length < 10) {
        throw new Error('Please enter a valid contact number (at least 10 digits)');
      }

      // Validate student ID if provided
      let studentId = formData.studentId.trim();
      if (studentId && !/^[A-Z0-9-]{3,}$/.test(studentId)) {
        throw new Error('Student ID must contain only letters, numbers, and hyphens (min 3 characters)');
      }

      // Prepare student data
      const studentData = {
        name: formData.name.trim(),
        fatherName: formData.fatherName.trim(),
        contact: cleanContact,
        program: formData.program.trim(),
        registrationFee: parseFloat(formData.registrationFee) || 0,
        tuitionFee: parseFloat(formData.tuitionFee) || 0,
        examFee: parseFloat(formData.examFee) || 0,
        universityShare: parseFloat(formData.universityShare) || 0,
        others: parseFloat(formData.others) || 0,
        totalFee: calculateTotal(),
        status: 'Active',
        admissionDate: new Date().toISOString().split('T')[0]
      };

      // Add student to Firebase with optional manual ID
      const studentDocId = await studentsService.addStudent(
        studentData, 
        studentId || null
      );

      setMessage(
        <div className="success-message-content">
          <h4>✅ Student Added Successfully!</h4>
          <p><strong>Student ID:</strong> {studentDocId}</p>
          <p><strong>Name:</strong> {studentData.name}</p>
          <p><strong>Program:</strong> {studentData.program}</p>
          <p><strong>Contact:</strong> {studentData.contact}</p>
          <p><strong>Total Fee:</strong> Rs{calculateTotal().toLocaleString()}</p>
          <p><strong>Note:</strong> Use <strong>{studentDocId}</strong> for all future transactions</p>
          <p className="success-note">Redirecting to student details in 3 seconds...</p>
        </div>
      );

      // Reset form and redirect
      setTimeout(() => {
        setFormData({
          studentId: '',
          name: '',
          fatherName: '',
          contact: '',
          program: '',
          registrationFee: '',
          tuitionFee: '',
          examFee: '',
          universityShare: '',
          others: '',
        });
        navigate(`/student-details/${studentDocId}`);
      }, 3000);

    } catch (error) {
      setError(error.message || 'Failed to save admission. Please try again.');
      console.error('Admission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? All entered data will be lost.')) {
      navigate('/search-student');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="new-admission">
      <div className="page-header">
        <h2>New Student Admission</h2>
        <div className="student-id-note">
          <p>Enter a custom Student ID or leave blank for auto-generation</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {message && (
        <div className="success-message">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admission-form">
        <div className="form-section">
          <h3>Student ID</h3>
          
          <div className="form-row">
            <div className="form-group student-id-group">
              <label htmlFor="studentId">
                Student ID
                <button 
                  type="button"
                  onClick={handleAutoGenerate}
                  className="generate-id-btn"
                  disabled={loading || studentIdStatus.checking}
                >
                  Auto Generate
                </button>
              </label>
              <input
                type="text"
                id="studentId"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                placeholder="e.g., Bsfxxxxxxx or leave blank for auto-generation"
                disabled={loading}
                className={
                  studentIdStatus.checking ? 'checking' :
                  !studentIdStatus.available && formData.studentId ? 'not-available' :
                  studentIdStatus.available && formData.studentId ? 'available' : ''
                }
              />
              
              {studentIdStatus.checking && (
                <div className="status-message checking">
                  <span className="spinner-small"></span> Checking availability...
                </div>
              )}
              
              {!studentIdStatus.checking && formData.studentId && (
                <div className={`status-message ${
                  studentIdStatus.available ? 'available' : 'not-available'
                }`}>
                  {studentIdStatus.message}
                </div>
              )}
              
              <div className="hint-text">
                Format: Letters, numbers, hyphens only (e.g., 2025CS001, STU-25-001)
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Student Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Student Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter full name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="fatherName">Father's Name *</label>
              <input
                type="text"
                id="fatherName"
                name="fatherName"
                value={formData.fatherName}
                onChange={handleChange}
                required
                placeholder="Enter father's name"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contact">Contact Number *</label>
              <input
                type="tel"
                id="contact"
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                required
                placeholder="Enter contact number"
                disabled={loading}
                pattern="[0-9]{10,}"
                title="Please enter at least 10 digits"
              />
            </div>
            <div className="form-group">
              <label htmlFor="program">Program *</label>
              <select
                id="program"
                name="program"
                value={formData.program}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="">Select Program</option>
                <option value="B.Ed">B.Ed (Bachelor of Education)</option>
                <option value="M.Ed">M.Ed (Master of Education)</option>
                <option value="D.El.Ed">D.El.Ed (Diploma in Elementary Education)</option>
                <option value="B.P.Ed">B.P.Ed (Bachelor of Physical Education)</option>
                <option value="M.P.Ed">M.P.Ed (Master of Physical Education)</option>
                <option value="B.A.B.Ed">B.A.B.Ed (Integrated)</option>
                <option value="B.Sc.B.Ed">B.Sc.B.Ed (Integrated)</option>
                <option value="Ph.D">Ph.D in Education</option>
                <option value="BS Computer Science">BS Computer Science</option>
                <option value="BS Software Engineering">BS Software Engineering</option>
                <option value="BS Information Technology">BS Information Technology</option>
                <option value="BS English">BS English</option>
                <option value="BS Mathematics">BS Mathematics</option>
                <option value="BS Chemistry">BS Chemistry</option>
                <option value="BS Physics">BS Physics</option>
                <option value="BS Biology">BS Biology</option>
                <option value="BS Psychology">BS Psychology</option>
                <option value="BS Economics">BS Economics</option>
                <option value="BS Sociology">BS Sociology</option>
                <option value="BS Islamic Studies">BS Islamic Studies</option>
                <option value="BS Education">BS Education</option>
                <option value="BS Political Science">BS Political Science</option>
                <option value="BS Mass Communication">BS Mass Communication</option>
                <option value="BS Botany">BS Botany</option>
                <option value="BS Zoology">BS Zoology</option>
                <option value="BS Statistics">BS Statistics</option>
                <option value="Other">Other Program</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Fee Structure</h3>
          <div className="fee-note">
            <p>Set up the fee structure for the student. These values will be used for fee challan generation.</p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="registrationFee">Registration Fee</label>
              <input
                type="number"
                id="registrationFee"
                name="registrationFee"
                value={formData.registrationFee}
                onChange={handleNumberChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="tuitionFee">Tuition Fee</label>
              <input
                type="number"
                id="tuitionFee"
                name="tuitionFee"
                value={formData.tuitionFee}
                onChange={handleNumberChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="examFee">Exam Fee</label>
              <input
                type="number"
                id="examFee"
                name="examFee"
                value={formData.examFee}
                onChange={handleNumberChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="universityShare">University Share</label>
              <input
                type="number"
                id="universityShare"
                name="universityShare"
                value={formData.universityShare}
                onChange={handleNumberChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="others">Other Fees</label>
              <input
                type="number"
                id="others"
                name="others"
                value={formData.others}
                onChange={handleNumberChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
            <div className="form-group total-fee-display">
              <label>Total Fee</label>
              <div className="total-fee-amount">
                {formatCurrency(calculateTotal())}
              </div>
              <div className="fee-breakdown">
                Sum of all fee components
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={handleCancel}
            className="cancel-btn"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading || (!studentIdStatus.available && formData.studentId)} 
            className="submit-btn"
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Saving...
              </>
            ) : (
              'Save Admission'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewAdmission;