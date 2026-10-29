interface FilterBarProps {
  districts: string[];
  selectedDistrict: string;
  selectedGender: string;
  selectedAgeGroup: string;
  onDistrictChange: (v: string) => void;
  onGenderChange: (v: string) => void;
  onAgeGroupChange: (v: string) => void;
  onReset: () => void;
}

const GENDERS = [
  { value: "", label: "All genders" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const AGE_GROUPS = [
  { value: "", label: "All ages" },
  { value: "under-18", label: "Under 18" },
  { value: "18-30", label: "18–30" },
  { value: "31-50", label: "31–50" },
  { value: "51+", label: "51+" },
];

const selectStyle: React.CSSProperties = {
  padding: "0.45rem 0.75rem",
  border: "1px solid #3a5267",
  borderRadius: "0.65rem",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#f1f7ff",
  background: "#101a26",
  boxShadow: "0 4px 14px rgba(0,0,0,.16)",
  cursor: "pointer",
  minWidth: "140px",
};

export function FilterBar({
  districts,
  selectedDistrict,
  selectedGender,
  selectedAgeGroup,
  onDistrictChange,
  onGenderChange,
  onAgeGroupChange,
  onReset,
}: FilterBarProps) {
  const hasFilter = selectedDistrict || selectedGender || selectedAgeGroup;

  return (
    <div
      role="search"
      aria-label="Filter recordings"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "center",
        padding: "1rem",
        background: "linear-gradient(135deg, rgba(16,26,38,.98), rgba(13,18,29,.98))",
        borderRadius: "0.9rem",
        border: "1px solid #2b3d4f",
        boxShadow: "0 10px 28px rgba(0,0,0,.16)",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#a9c0d8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          District
        </span>
        <select
          aria-label="Select district"
          value={selectedDistrict}
          onChange={(e) => onDistrictChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#a9c0d8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Gender
        </span>
        <select
          aria-label="Select gender"
          value={selectedGender}
          onChange={(e) => onGenderChange(e.target.value)}
          style={selectStyle}
        >
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#a9c0d8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Age Group
        </span>
        <select
          aria-label="Select age group"
          value={selectedAgeGroup}
          onChange={(e) => onAgeGroupChange(e.target.value)}
          style={selectStyle}
        >
          {AGE_GROUPS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </label>

      {hasFilter && (
        <button
          onClick={onReset}
          aria-label="Reset all filters"
          style={{
            padding: "0.45rem 1rem",
            background: "transparent",
            border: "1px solid #38516a",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            color: "#d5e7f7",
            cursor: "pointer",
            alignSelf: "flex-end",
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
