import React, { useState } from 'react';
import { studentsService, challansService, utils } from '../../services/firebaseService';
import './AdvanceChallan.css';

const AdvanceChallan = () => {
  const [formData, setFormData] = useState({
    studentId: '',
    feeType: 'tuition',
    periodType: 'month',
    months: [],
    semester: '',
    year: new Date().getFullYear().toString(),
    totalAmount: '',
    dueDate: '',
    description: '',
  });
  
  const [studentDetails, setStudentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStudentSearch = async () => {
    if (!formData.studentId.trim()) return;
    
    setSearchLoading(true);
    setError('');
    setStudentDetails(null);
    
    try {
      const student = await studentsService.getStudentById(formData.studentId);
      setStudentDetails(student);
      
      // Auto-calculate fee amount based on student's program
      const calculatedAmount = utils.calculateTotalFees(student) || 0;
      setFormData(prev => ({
        ...prev,
        totalAmount: calculatedAmount > 0 ? calculatedAmount.toString() : ''
      }));
    } catch (error) {
      setError('Student not found. Please check Student ID.');
    }
    
    setSearchLoading(false);
  };

  const handleMonthChange = (month) => {
    setFormData(prev => ({
      ...prev,
      months: prev.months.includes(month)
        ? prev.months.filter(m => m !== month)
        : [...prev.months, month]
    }));
  };

  const handlePeriodTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      periodType: type,
      months: type === 'semester' ? [] : prev.months,
      semester: type === 'month' ? '' : prev.semester
    }));
  };

  const handleFeeTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      feeType: type
    }));
  };

  const calculateTotal = () => {
    const baseAmount = parseFloat(formData.totalAmount) || 0;
    
    if (formData.periodType === 'month') {
      return (baseAmount * formData.months.length).toFixed(2);
    } else {
      // For semester, typically one payment covers the whole period
      return baseAmount.toFixed(2);
    }
  };

  const getFeeTypeLabel = (type) => {
    const feeTypes = {
      tuition: 'Tuition Fee',
      registration: 'Registration Fee',
      exam: 'Exam Fee',
      library: 'Library Fee',
      sports: 'Sports Fee',
      transportation: 'Transportation Fee',
      other: 'Other Fee'
    };
    return feeTypes[type] || type;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!studentDetails) {
        throw new Error('Please search and select a student first');
      }

      if (formData.periodType === 'month' && formData.months.length === 0) {
        throw new Error('Please select at least one month for monthly fees.');
      }

      if (formData.periodType === 'semester' && !formData.semester) {
        throw new Error('Please select a semester for semester fees.');
      }

      const challanData = {
        studentId: formData.studentId,
        studentName: studentDetails.name || 'Unknown Student',
        program: studentDetails.program || studentDetails.class || 'Unknown Program',
        semester: studentDetails.semester || 'Not Specified', // Fallback for semester
        feeType: formData.feeType,
        feeTypeLabel: getFeeTypeLabel(formData.feeType),
        periodType: formData.periodType,
        months: formData.months || [],
        semesterPeriod: formData.semester || '',
        year: formData.year,
        amount: parseFloat(formData.totalAmount) || 0,
        totalAmount: parseFloat(calculateTotal()) || 0,
        dueDate: formData.dueDate,
        description: formData.description || `Advance ${getFeeTypeLabel(formData.feeType)} for ${formData.periodType === 'month' ? formData.months.length + ' month(s)' : formData.semester}`,
        status: 'Unpaid (Future)',
        isAdvance: true,
        issueDate: new Date().toISOString().split('T')[0],
        challanNumber: utils.generateChallanNumber(),
        createdAt: new Date()
      };

      // Validate required fields before submission
      if (!challanData.studentId || !challanData.studentName || !challanData.program) {
        throw new Error('Missing required student information.');
      }

      if (!challanData.dueDate) {
        throw new Error('Due date is required.');
      }

      // Save to Firebase
      await challansService.addChallan(challanData);
      
      setSuccess('Advance challan generated successfully! Status: Unpaid (Future)');
      
      // Reset form but keep student info
      setFormData(prev => ({
        studentId: prev.studentId,
        feeType: 'tuition',
        periodType: 'month',
        months: [],
        semester: '',
        year: new Date().getFullYear().toString(),
        totalAmount: '',
        dueDate: '',
        description: '',
      }));
      
    } catch (error) {
      setError(error.message || 'Failed to generate advance challan. Please try again.');
      console.error('Challan generation error:', error);
    }

    setLoading(false);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const semesters = ['Spring', 'Summer', 'Fall', 'Winter'];

  const feeTypes = [
    { value: 'tuition', label: 'Tuition Fee' },
    { value: 'registration', label: 'Registration Fee' },
    { value: 'exam', label: 'Exam Fee' },
    { value: 'library', label: 'Library Fee' },
    { value: 'sports', label: 'Sports Fee' },
    { value: 'transportation', label: 'Transportation Fee' },
    { value: 'other', label: 'Other Fee' }
  ];

  return (
    <div className="advance-challan">
      <h2>Generate Advance Fee Challan</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit} className="challan-form">
        {/* Student Search */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="studentId">Student ID *</label>
            <div className="search-btn-container">
              <input
                type="text"
                id="studentId"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                required
                placeholder="Enter student ID"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleStudentSearch}
                disabled={searchLoading || !formData.studentId}
                className="search-btn"
              >
                {searchLoading ? 'Searching...' : 'Search Student'}
              </button>
            </div>
          </div>
        </div>

        {/* Student Information Display */}
        {studentDetails && (
          <div className="student-info">
            <h4>Student Information</h4>
            <div className="student-details">
              <div className="student-detail">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{studentDetails.name || 'N/A'}</span>
              </div>
              <div className="student-detail">
                <span className="detail-label">Program:</span>
                <span className="detail-value">{studentDetails.program || studentDetails.class || 'N/A'}</span>
              </div>
              <div className="student-detail">
                <span className="detail-label">Current Semester:</span>
                <span className="detail-value">{studentDetails.semester || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Fee Type Selection */}
        <div className="form-group">
          <label>Fee Type *</label>
          <div className="fee-type-grid">
            {feeTypes.map((feeType) => (
              <div key={feeType.value} className="fee-type-option">
                <input
                  type="radio"
                  id={`fee-${feeType.value}`}
                  name="feeType"
                  value={feeType.value}
                  checked={formData.feeType === feeType.value}
                  onChange={() => handleFeeTypeChange(feeType.value)}
                  className="fee-type-radio"
                />
                <label htmlFor={`fee-${feeType.value}`} className="fee-type-label">
                  {feeType.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Period Type Selection */}
        <div className="form-group">
          <label>Period Type *</label>
          <div className="period-selection">
            <div className="period-option">
              <input
                type="radio"
                id="period-month"
                name="periodType"
                value="month"
                checked={formData.periodType === 'month'}
                onChange={() => handlePeriodTypeChange('month')}
                className="period-radio"
              />
              <label htmlFor="period-month" className="period-label">
                Monthly Fees
              </label>
            </div>
            <div className="period-option">
              <input
                type="radio"
                id="period-semester"
                name="periodType"
                value="semester"
                checked={formData.periodType === 'semester'}
                onChange={() => handlePeriodTypeChange('semester')}
                className="period-radio"
              />
              <label htmlFor="period-semester" className="period-label">
                Semester Fees
              </label>
            </div>
          </div>
        </div>

        {/* Month Selection (for monthly fees) */}
        {formData.periodType === 'month' && (
          <div className="form-group">
            <label>Select Months *</label>
            <div className="months-grid">
              {monthNames.map((month, index) => (
                <label 
                  key={index} 
                  className={`month-checkbox ${formData.months.includes((index + 1).toString()) ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={formData.months.includes((index + 1).toString())}
                    onChange={() => handleMonthChange((index + 1).toString())}
                  />
                  {month}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Semester Selection (for semester fees) */}
        {formData.periodType === 'semester' && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="semester">Semester *</label>
              <select
                id="semester"
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                required
              >
                <option value="">Select Semester</option>
                {semesters.map((semester, index) => (
                  <option key={index} value={semester}>
                    {semester} {formData.year}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="year">Year *</label>
              <select
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Amount Inputs */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="totalAmount">
              {formData.periodType === 'month' ? 'Fee Amount per Month *' : 'Semester Fee Amount *'}
            </label>
            <input
              type="number"
              id="totalAmount"
              name="totalAmount"
              value={formData.totalAmount}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
              placeholder={`Enter ${formData.periodType === 'month' ? 'monthly' : 'semester'} fee amount`}
            />
          </div>
          <div className="form-group">
            <label>Total Amount</label>
            <input
              type="text"
              value={`Rs${calculateTotal()}`}
              readOnly
              className="total-display"
            />
          </div>
        </div>

        {/* Due Date and Description */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="dueDate">Due Date *</label>
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              required
              min={new Date().toISOString().split('T')[0]} // Prevent past dates
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !studentDetails} 
          className="submit-btn"
        >
          {loading ? 'Generating Advance Challan...' : 'Generate Advance Challan'}
        </button>
      </form>
    </div>
  );
};

export default AdvanceChallan;