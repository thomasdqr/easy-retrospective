import React from 'react';
import { SubmissionFormProps } from './types';

const SubmissionForm: React.FC<SubmissionFormProps> = ({ 
  statements, 
  setStatements, 
  onSubmit 
}) => {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <p className="mb-6 text-gray-700">Enter two true statements and one lie about yourself:</p>
      {statements.map((statement, index) => (
        <div key={index} className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {index === 2 ? "The Lie:" : `Truth ${index + 1}:`}
          </label>
          <input
            type="text"
            value={statement.text}
            onChange={(e) => {
              const newStatements = [...statements];
              newStatements[index].text = e.target.value;
              setStatements(newStatements);
            }}
            placeholder={index === 2 ? "Enter your lie" : `Enter truth ${index + 1}`}
            className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      ))}
      <button
        onClick={onSubmit}
        className="w-full bg-indigo-600 text-white px-6 py-3 rounded-md font-medium shadow-md hover:bg-indigo-700 transition-colors duration-200"
      >
        Submit
      </button>
    </div>
  );
};

export default SubmissionForm; 