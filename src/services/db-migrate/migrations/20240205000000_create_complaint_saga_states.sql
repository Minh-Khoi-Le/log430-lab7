-- Migration: Create complaint saga states table
-- Description: Creates table to store complaint saga state for choreographed saga coordination

-- Create complaint saga states table
CREATE TABLE IF NOT EXISTS complaint_saga_states (
    saga_id UUID PRIMARY KEY,
    complaint_id UUID NOT NULL,
    correlation_id UUID NOT NULL UNIQUE,
    customer_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255),
    store_id INTEGER NOT NULL DEFAULT 1,
    
    -- Saga metadata
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    current_step VARCHAR(100) NOT NULL DEFAULT 'SAGA_INITIATED',
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Business data (stored as JSONB for flexibility)
    complaint_data JSONB NOT NULL,
    
    -- Step results (stored as JSONB for flexibility)
    customer_validation JSONB,
    order_verification JSONB,
    resolution_processing JSONB,
    compensation JSONB,
    
    -- Error and execution tracking
    errors JSONB NOT NULL DEFAULT '[]',
    step_history JSONB NOT NULL DEFAULT '[]',
    
    -- Indexes for performance
    CONSTRAINT chk_saga_status CHECK (status IN (
        'INITIATED', 'CUSTOMER_VALIDATING', 'ORDER_VERIFYING', 
        'RESOLUTION_PROCESSING', 'COMPLETED', 'COMPENSATING', 
        'COMPENSATED', 'FAILED'
    )),
    
    CONSTRAINT chk_saga_step CHECK (current_step IN (
        'SAGA_INITIATED', 'CUSTOMER_VALIDATION', 'ORDER_VERIFICATION',
        'RESOLUTION_PROCESSING', 'SAGA_COMPLETION', 'COMPENSATION', 'SAGA_FAILURE'
    ))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_complaint_id ON complaint_saga_states(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_correlation_id ON complaint_saga_states(correlation_id);
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_customer_id ON complaint_saga_states(customer_id);
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_status ON complaint_saga_states(status);
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_initiated_at ON complaint_saga_states(initiated_at);
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_current_step ON complaint_saga_states(current_step);

-- Create partial index for active sagas (performance optimization)
CREATE INDEX IF NOT EXISTS idx_complaint_saga_states_active ON complaint_saga_states(initiated_at, status) 
WHERE status NOT IN ('COMPLETED', 'FAILED', 'COMPENSATED');

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_complaint_saga_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_complaint_saga_states_updated_at
    BEFORE UPDATE ON complaint_saga_states
    FOR EACH ROW
    EXECUTE FUNCTION update_complaint_saga_states_updated_at();

-- Add comments for documentation
COMMENT ON TABLE complaint_saga_states IS 'Stores state for choreographed complaint handling sagas';
COMMENT ON COLUMN complaint_saga_states.saga_id IS 'Unique identifier for the saga instance';
COMMENT ON COLUMN complaint_saga_states.complaint_id IS 'ID of the complaint being processed';
COMMENT ON COLUMN complaint_saga_states.correlation_id IS 'Correlation ID for tracking events across services';
COMMENT ON COLUMN complaint_saga_states.customer_id IS 'ID of the customer who filed the complaint';
COMMENT ON COLUMN complaint_saga_states.order_id IS 'Optional order ID if complaint is related to an order';
COMMENT ON COLUMN complaint_saga_states.status IS 'Current status of the saga execution';
COMMENT ON COLUMN complaint_saga_states.current_step IS 'Current step being executed in the saga';
COMMENT ON COLUMN complaint_saga_states.complaint_data IS 'Business data about the complaint (JSONB)';
COMMENT ON COLUMN complaint_saga_states.customer_validation IS 'Results of customer validation step (JSONB)';
COMMENT ON COLUMN complaint_saga_states.order_verification IS 'Results of order verification step (JSONB)';
COMMENT ON COLUMN complaint_saga_states.resolution_processing IS 'Results of resolution processing step (JSONB)';
COMMENT ON COLUMN complaint_saga_states.compensation IS 'Compensation details if saga failed (JSONB)';
COMMENT ON COLUMN complaint_saga_states.errors IS 'Array of errors encountered during saga execution (JSONB)';
COMMENT ON COLUMN complaint_saga_states.step_history IS 'History of step executions with timing (JSONB)';