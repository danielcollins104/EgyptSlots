package com.dcenterprises.egyptslots;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private CasinoConfigRepository configRepository;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (configRepository == null) {
            configRepository = new DefaultCasinoConfigRepository(this);
        }
    }

    public CasinoConfigRepository getConfigRepository() {
        if (configRepository == null) {
            configRepository = new DefaultCasinoConfigRepository(this);
        }
        return configRepository;
    }

    public void setConfigRepositoryForTesting(CasinoConfigRepository customRepository) {
        this.configRepository = customRepository;
    }
}
