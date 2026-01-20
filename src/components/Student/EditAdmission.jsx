import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentsService, utils } from '../../services/firebaseService';
import './EditAdmission.css';

const EditAdmission = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    contact: '',
    program: '',
    registrationFee: '',
    tuitionFee: '',
    examFee: '',
    universityShare: '',
    others: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [studentInfo, setStudentInfo] = useState(null);

  useEffect(() => {
    fetchStudentData();
  }, [studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const studentData = await studentsService.getStudentById(studentId);
      
      setStudentInfo({
        id: studentData.id,
        ...studentData
      });
      
      setFormData({
        name: studentData.name || '',
        fatherName: studentData.fatherName || '',
        contact: studentData.contact || '',
        program: studentData.program || '',
        registrationFee: studentData.registrationFee || '',
        tuitionFee: studentData.tuitionFee || '',
        examFee: studentData.examFee || '',
        universityShare: studentData.universityShare || '',
        others: studentData.others || ''
      });
    } catch (error) {
      console.error('Error fetching student data:', error);
      setError('Failed to load student data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : parseFloat(value) || 0
    }));
  };

  const calculateTotalFee = () => {
    return utils.calculateTotalFees({
      registrationFee: parseFloat(formData.registrationFee) || 0,
      tuitionFee: parseFloat(formData.tuitionFee) || 0,
      examFee: parseFloat(formData.examFee) || 0,
      universityShare: parseFloat(formData.universityShare) || 0,
      others: parseFloat(formData.others) || 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Prepare data for update
      const updateData = {
        name: formData.name.trim(),
        fatherName: formData.fatherName.trim(),
        contact: formData.contact.trim(),
        program: formData.program,
        registrationFee: parseFloat(formData.registrationFee) || 0,
        tuitionFee: parseFloat(formData.tuitionFee) || 0,
        examFee: parseFloat(formData.examFee) || 0,
        universityShare: parseFloat(formData.universityShare) || 0,
        others: parseFloat(formData.others) || 0,
        totalFee: calculateTotalFee(),
        updatedAt: new Date()
      };

      // Validate required fields
      if (!updateData.name || !updateData.fatherName || !updateData.contact || !updateData.program) {
        throw new Error('Please fill in all required fields');
      }

      // Validate contact number
      if (!/^\d{10,}$/.test(updateData.contact.replace(/\D/g, ''))) {
        throw new Error('Please enter a valid contact number (at least 10 digits)');
      }

      await studentsService.updateStudent(studentId, updateData);
      
      alert('Student information updated successfully!');
      navigate('/search-student');
    } catch (error) {
      console.error('Error updating student:', error);
      setError(error.message || 'Failed to update student information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading student data...</p>
      </div>
    );
  }

  if (error && !studentInfo) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Student</h3>
        <p>{error}</p>
        <div className="error-actions">
          <button 
            onClick={() => navigate('/search-student')}
            className="back-btn"
          >
            Back to Search
          </button>
          <button 
            onClick={fetchStudentData}
            className="retry-btn"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-admission">
      <div className="page-header">
        <h2>Edit Student Information</h2>
        {studentInfo && (
          <div className="student-info">
            <div className="student-info-badge">
              <span>Student ID: {studentInfo.id}</span>
            </div>
            <div className="student-meta">
              <span>Created: {studentInfo.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}</span>
              {studentInfo.updatedAt && (
                <span>Last Updated: {studentInfo.updatedAt.toDate().toLocaleDateString()}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admission-form">
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
                placeholder="Enter student full name"
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                <option value="Other">Other Program</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group info-group">
              <label>Student Status</label>
              <div className="status-info">
                <span className={`status-badge ${studentInfo?.status || 'active'}`}>
                  {studentInfo?.status || 'Active'}
                </span>
              </div>
            </div>
            <div className="form-group total-fee-display">
              <label>Current Total Fee</label>
              <div className="total-fee-amount">
                {formatCurrency(calculateTotalFee())}
              </div>
              <div className="fee-breakdown">
                Sum of all fee components
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Fee Structure</h3>
          <div className="fee-note">
            <p>Update the fee structure as needed. Changes will affect future challans.</p>
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
              />
            </div>
            <div className="form-group"></div>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={handleCancel}
            className="cancel-btn"
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={saving} 
            className="submit-btn"
          >
            {saving ? (
              <>
                <div className="spinner"></div>
                Updating...
              </>
            ) : (
              'Update Student'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditAdmission;