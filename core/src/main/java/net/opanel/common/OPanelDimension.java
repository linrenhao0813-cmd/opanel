package net.opanel.common;

public enum OPanelDimension {
    OVERWORLD("overworld"),
    NETHER("nether"),
    THE_END("the_end");

    private final String name;

    OPanelDimension(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public static OPanelDimension fromString(String name) {
        switch(name) {
            case "overworld" -> { return OVERWORLD; }
            case "nether" -> { return NETHER; }
            case "the_end" -> { return THE_END; }
        }
        return null;
    }
}
