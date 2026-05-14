import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const FilterContext = createContext()

export function FilterProvider({ children }) {
  const [employee, setEmployeeState] = useState('all')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [datePreset, setDatePreset] = useState('all')
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')

  const setEmployee = useCallback((val) => setEmployeeState(val), [])

  const setDateRange = useCallback(({ startDate: sd, endDate: ed }) => {
    setStartDate(sd)
    setEndDate(ed)
  }, [])

  const resetFilters = useCallback(() => {
    setEmployeeState('all')
    setStartDate(null)
    setEndDate(null)
    setDatePreset('all')
    setChannel('all')
    setStatus('all')
  }, [])

  const queryParams = useMemo(() => ({
    employee,
    start_date: startDate,
    end_date: endDate,
  }), [employee, startDate, endDate])

  const value = useMemo(() => ({
    employee, startDate, endDate, datePreset, channel, status,
    setEmployee, setDateRange, setDatePreset, setChannel, setStatus, resetFilters,
    queryParams,
  }), [employee, startDate, endDate, datePreset, channel, status, setEmployee, setDateRange, setDatePreset, setChannel, setStatus, resetFilters, queryParams])

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  return useContext(FilterContext)
}
