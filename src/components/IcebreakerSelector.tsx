import { IcebreakerType, ICEBREAKER_TYPES } from '../types/icebreaker';

interface IcebreakerSelectorProps {
  selectedType: IcebreakerType;
  onChange: (type: IcebreakerType) => void;
}

function IcebreakerSelector({ selectedType, onChange }: IcebreakerSelectorProps) {
  return (
    <div className="mt-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select an Icebreaker Activity
      </label>
      <div className="space-y-3">
        {ICEBREAKER_TYPES.map((icebreaker) => (
          <div 
            key={icebreaker.type}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedType === icebreaker.type
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-25'
            }`}
            onClick={() => onChange(icebreaker.type)}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <input
                  type="radio"
                  checked={selectedType === icebreaker.type}
                  onChange={() => {}}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">{icebreaker.name}</h3>
                <p className="text-sm text-gray-500">{icebreaker.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default IcebreakerSelector; 