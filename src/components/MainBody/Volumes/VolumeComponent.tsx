import { Volume } from "../../../types";
import { MouseEventHandler } from "react";

interface Props {
    volume: Volume;
    onClick: MouseEventHandler<HTMLButtonElement>;
}

export default function VolumeComponent({ volume, onClick }: Props) {
    const usedPercentage = (volume.used_gb / volume.total_gb) * 100;
    const isLowSpace = usedPercentage > 85;
    
    return (
        <button
            onClick={onClick}
            className="group w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 
                       p-5 transition-all duration-200 hover:shadow-md hover:border-blue-300 
                       hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 
                       focus:ring-opacity-50 cursor-pointer text-left"
        >
            {/* Volume Icon and Name */}
            <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl 
                               flex items-center justify-center mr-4 group-hover:from-blue-200 
                               group-hover:to-blue-100 transition-colors duration-200">
                    <svg 
                        className="w-6 h-6 text-blue-600" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                        />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate text-lg">
                        {volume.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate mt-1">
                        {volume.mountpoint}
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-medium ${isLowSpace ? 'text-red-600' : 'text-gray-700'}`}>
                        {usedPercentage.toFixed(1)}% used
                    </span>
                    <span className="text-xs text-gray-500">
                        {volume.used_gb.toFixed(1)} GB / {volume.total_gb.toFixed(1)} GB
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                            isLowSpace 
                                ? 'bg-gradient-to-r from-red-500 to-red-600' 
                                : 'bg-gradient-to-r from-blue-500 to-blue-600'
                        }`}
                        style={{ width: `${usedPercentage}%` }}
                    />
                </div>
            </div>

            {/* Free Space Info */}
            <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isLowSpace ? 'text-red-600' : 'text-green-600'}`}>
                    <svg 
                        className="inline w-4 h-4 mr-1" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M5 13l4 4L19 7" 
                        />
                    </svg>
                    {volume.available_gb.toFixed(1)} GB free
                </span>
                {isLowSpace && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                        Low space
                    </span>
                )}
            </div>
        </button>
    );
}