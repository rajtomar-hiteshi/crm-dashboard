import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const FilterContext = createContext()

export function FilterProvider({ children }) {
  const [employee, setEmployeeState] = useState('all')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [datePreset, setDatePreset] = useState('all')
  const [period, setPeriod] = useState(null)
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
    setPeriod(null)
    setChannel('all')
    setStatus('all')
  }, [])

  const queryParams = useMemo(() => {
    const params = { employee }
    if (period) {
      params.period = period
    } else if (startDate || endDate) {
      params.start_date = startDate
      params.end_date = endDate
    }
    return params
  }, [employee, startDate, endDate, period])

  const value = useMemo(() => ({
    employee, startDate, endDate, datePreset, period, channel, status,
    setEmployee, setDateRange, setDatePreset, setPeriod, setChannel, setStatus, resetFilters,
    queryParams,
  }), [employee, startDate, endDate, datePreset, period, channel, status, setEmployee, setDateRange, setDatePreset, setPeriod, setChannel, setStatus, resetFilters, queryParams])

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  return useContext(FilterContext)
}
