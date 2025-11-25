/**
 * TimeRangeSlider Component
 * 
 * A reusable time range selector with a sliding orange indicator.
 * Allows users to select between day, week, month, and year views.
 */

import { useRef, useEffect, useState } from 'react'
import '../styles/TimeRangeSlider.css'

interface TimeRangeSliderProps {
    selectedRange: 'day' | 'week' | 'month' | 'year'
    onRangeChange: (range: 'day' | 'week' | 'month' | 'year') => void
    accentColor?: string // optional accent color for slider and active button
}

const TimeRangeSlider = ({ selectedRange, onRangeChange, accentColor }: TimeRangeSliderProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [sliderLeft, setSliderLeft] = useState(6) // Initial left position (padding)
    
    const ranges: ('day' | 'week' | 'month' | 'year')[] = ['day', 'week', 'month', 'year']
    const labels: { [key: string]: string } = {
        'day': 'D',
        'week': 'W',
        'month': 'M',
        'year': 'Y'
    }

    useEffect(() => {
        const updateSliderPosition = () => {
            if (!containerRef.current) return

            const container = containerRef.current
            const buttons = container.querySelectorAll('.time-range-button')
            
            if (buttons.length === 0) return

            const selectedIndex = ranges.indexOf(selectedRange)
            const firstButton = buttons[0] as HTMLElement
            const buttonRect = firstButton.getBoundingClientRect()
            
            // Calculate button width and gap
            const buttonWidth = buttonRect.width
            const gap = 8 // Gap between buttons from CSS
            const padding = 6 // Padding from CSS
            
            // Calculate slider position: padding + index * (button width + gap)
            const leftPosition = padding + selectedIndex * (buttonWidth + gap)
            setSliderLeft(leftPosition)
        }

        // Update position when selection changes or on mount
        updateSliderPosition()

        // Update position on window resize
        window.addEventListener('resize', updateSliderPosition)
        
        return () => {
            window.removeEventListener('resize', updateSliderPosition)
        }
    }, [selectedRange, ranges])

    return (
        <div className="time-range-selector" ref={containerRef} style={accentColor ? ({ ['--trs-accent' as any]: accentColor } as any) : undefined}>
            {/* Sliding orange background */}
            <div 
                className="time-range-slider"
                style={{
                    left: `${sliderLeft}px`
                }}
            ></div>
            {ranges.map((range) => (
                <button
                    key={range}
                    className={`time-range-button ${selectedRange === range ? 'active' : ''}`}
                    onClick={() => onRangeChange(range)}
                >
                    {labels[range]}
                </button>
            ))}
        </div>
    )
}

export default TimeRangeSlider

